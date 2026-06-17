import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton
from datetime import datetime, date
import json
from app.utils.config import settings
from app.utils.logger import logger
from app.database.database import SessionLocal
from app.database.repositories import product_repo
from app.database.models import ProductMatchReview, Transaction, Product
from app.services.inventory_service import get_inventory_stock
from app.services.matching_service import match_product_name
from app.services.transaction_service import record_transaction
from app.services.validation_service import compute_image_hash, is_duplicate_invoice
from app.ocr.gemini_client import extract_invoice_data
from app.reports.excel_generator import generate_monthly_report

bot = telebot.TeleBot(settings.BOT_TOKEN) if settings.BOT_TOKEN else None
user_states = {}

@bot.message_handler(commands=['start', 'help'])
def send_welcome(message):
    bot.reply_to(message, "Accountant & Inventory Bot\n\n/purchase - Record purchase\n/sale - Record sale\n/stock - View stock\n/report YYYY-MM - Monthly report\n/reviews - Pending reviews")

@bot.message_handler(commands=['purchase', 'sale'])
def handle_transaction_command(message):
    action = message.text.replace("/", "").strip()
    user_states[message.chat.id] = f'waiting_for_{action}_image'
    bot.reply_to(message, f"Please upload the {action} invoice image.")

@bot.message_handler(content_types=['photo'])
def handle_photo(message):
    state = user_states.get(message.chat.id)
    if state not in ['waiting_for_purchase_image', 'waiting_for_sale_image']:
        return

    transaction_type = 'purchase' if state == 'waiting_for_purchase_image' else 'sale'
    user_states.pop(message.chat.id, None)

    logger.info(f"Processing new {transaction_type} image from {message.chat.id}")
    bot.reply_to(message, f"Processing {transaction_type} invoice...")

    file_info = bot.get_file(message.photo[-1].file_id)
    downloaded_file = bot.download_file(file_info.file_path)
    
    db = SessionLocal()
    try:
        # 1. Duplicate check
        img_hash = compute_image_hash(downloaded_file)
        if is_duplicate_invoice(db, img_hash):
            bot.reply_to(message, "⚠️ Duplicate invoice detected! This image has already been ingested.")
            return

        try:
            extraction, raw_json = extract_invoice_data(downloaded_file, "image/jpeg")
        except Exception as e:
            bot.reply_to(message, f"Error extracting data: {e}")
            return

        date_source = "invoice"
        try:
            if extraction.invoice_date:
                tx_date = datetime.strptime(extraction.invoice_date, "%Y-%m-%d").date()
            else:
                tx_date = date.today()
                date_source = "system"
        except Exception:
            tx_date = date.today()
            date_source = "system"

        db_products = product_repo.get_all_names(db)
        confirmation_lines = [f"✓ {transaction_type.capitalize()} Recorded\n"]
        
        invoice_filename = file_info.file_path.split("/")[-1] if "/" in file_info.file_path else None
        
        for item in extraction.items:
            matched_name, score = match_product_name(item.product_name, db_products)
            
            pending_data = {
                "transaction_type": transaction_type,
                "quantity": float(item.quantity),
                "rate": float(item.rate),
                "amount": float(item.amount),
                "transaction_date": tx_date.isoformat(),
                "date_source": date_source,
                "invoice_image_url": file_info.file_path,
                "invoice_filename": invoice_filename,
                "image_hash": img_hash,
                "raw_ai_response": raw_json
            }

            if score >= 90:
                final_name = matched_name
                prod = product_repo.get_by_name(db, final_name)
                record_transaction(db, prod.id, **pending_data)
                confirmation_lines.append(f"{final_name} {'+' if transaction_type=='purchase' else '-'}{item.quantity}")

            elif score >= 75:
                # Store as pending review
                prod = product_repo.get_by_name(db, matched_name)
                review = ProductMatchReview(
                    invoice_product_name=item.product_name,
                    suggested_product_id=prod.id,
                    similarity_score=score,
                    status="pending",
                    pending_transaction_data=json.dumps(pending_data)
                )
                db.add(review)
                confirmation_lines.append(f"⏳ Flagged for review: '{item.product_name}' -> '{matched_name}' ({score:.1f})")

            else:
                final_name = item.product_name
                prod = product_repo.create(db, {"name": final_name, "last_rate": item.rate})
                db_products.append(final_name)
                record_transaction(db, prod.id, **pending_data)
                confirmation_lines.append(f"✨ Created product: '{final_name}'")

        db.commit()
        bot.reply_to(message, "\n".join(confirmation_lines))

    except Exception as e:
        db.rollback()
        bot.reply_to(message, f"Database error: {e}")
    finally:
        db.close()

@bot.message_handler(commands=['reviews'])
def handle_reviews(message):
    db = SessionLocal()
    try:
        reviews = db.query(ProductMatchReview).filter(ProductMatchReview.status == 'pending').all()
        if not reviews:
            bot.reply_to(message, "No pending reviews! 🎉")
            return
            
        bot.reply_to(message, f"You have {len(reviews)} pending reviews.")
        for r in reviews:
            prod = db.query(Product).filter(Product.id == r.suggested_product_id).first()
            markup = InlineKeyboardMarkup()
            markup.add(
                InlineKeyboardButton("Approve Match", callback_data=f"review_approve_{r.id}"),
                InlineKeyboardButton("Create New", callback_data=f"review_createnew_{r.id}")
            )
            markup.add(InlineKeyboardButton("Reject & Ignore", callback_data=f"review_reject_{r.id}"))
            
            text = f"Review #{r.id}\nInvoice item: '{r.invoice_product_name}'\nSuggested match: '{prod.name}'\nConfidence: {r.similarity_score}%"
            bot.send_message(message.chat.id, text, reply_markup=markup)
    finally:
        db.close()

@bot.callback_query_handler(func=lambda call: call.data.startswith('review_'))
def handle_review_callback(call):
    action, r_id = call.data.split('_')[1], int(call.data.split('_')[2])
    db = SessionLocal()
    try:
        review = db.query(ProductMatchReview).filter(ProductMatchReview.id == r_id).first()
        if not review or review.status != 'pending':
            bot.answer_callback_query(call.id, "Review already processed.")
            return

        tx_data = json.loads(review.pending_transaction_data)
        
        # Helper to convert date strings back to dates
        tx_data["transaction_date"] = datetime.fromisoformat(tx_data["transaction_date"]).date()

        if action == 'approve':
            record_transaction(db, review.suggested_product_id, **tx_data)
            review.status = 'approved'
            bot.edit_message_text(f"Approved match: '{review.invoice_product_name}' -> '{review.suggested_product.name}'", call.message.chat.id, call.message.message_id)

        elif action == 'createnew':
            prod = product_repo.create(db, {"name": review.invoice_product_name, "last_rate": tx_data["rate"]})
            record_transaction(db, prod.id, **tx_data)
            review.status = 'rejected' # Rejected the match suggestion
            bot.edit_message_text(f"Created new product: '{review.invoice_product_name}'", call.message.chat.id, call.message.message_id)

        elif action == 'reject':
            review.status = 'rejected'
            bot.edit_message_text(f"Rejected and ignored: '{review.invoice_product_name}'", call.message.chat.id, call.message.message_id)

        db.commit()
    finally:
        db.close()

@bot.message_handler(commands=['stock'])
def handle_stock(message):
    args = message.text.split()
    db = SessionLocal()
    try:
        stocks = get_inventory_stock(db)
        if len(args) > 1:
            query = " ".join(args[1:])
            stocks = [s for s in stocks if query.lower() in s['product'].lower()]

        if not stocks:
            bot.reply_to(message, "No stock data available for query.")
            return
            
        lines = ["📦 Current Stock (Dynamic):"]
        for s in stocks:
            if s['stock'] != 0:
                lines.append(f"• {s['product']}: {s['stock']}")
        
        msg_text = "\n".join(lines)
        if len(msg_text) > 4000:
            bot.reply_to(message, msg_text[:4000] + "\n... (truncated)")
        else:
            bot.reply_to(message, msg_text)
    finally:
        db.close()

@bot.message_handler(commands=['report'])
def handle_report(message):
    args = message.text.split()
    if len(args) < 2:
        bot.reply_to(message, "Usage: /report YYYY-MM or /report YYYY")
        return
        
    date_arg = args[1]
    db = SessionLocal()
    try:
        from app.reports.excel_generator import generate_yearly_report
        
        if len(date_arg) == 4:
            bot.reply_to(message, f"Generating yearly report for {date_arg} (this may take a moment)...")
            report_path = generate_yearly_report(db, date_arg)
        else:
            bot.reply_to(message, f"Generating dynamic report for {date_arg}...")
            report_path = generate_monthly_report(db, date_arg)
            
        with open(report_path, 'rb') as f:
            bot.send_document(message.chat.id, f, visible_file_name=f"GST_{date_arg.replace('-', '_')}.xlsx")
    except Exception as e:
        logger.error(f"Error generating report: {e}")
        bot.reply_to(message, f"Error generating report: {e}")
    finally:
        db.close()

def run_bot():
    if bot:
        logger.info("Starting Telegram bot polling...")
        bot.infinity_polling()
    else:
        logger.warning("BOT_TOKEN not set, bot will not run.")
