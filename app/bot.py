import os
import telebot
from datetime import datetime, date
from app.database import SessionLocal
from app.inventory import match_product, get_all_product_names, calculate_stock
from app.ocr import extract_invoice_items
from app.models import Transaction, Product
from app.report import generate_monthly_report

BOT_TOKEN = os.getenv("BOT_TOKEN")
# We initialize the bot here. When running with FastAPI, we can either use Webhooks or start polling in a background thread.
bot = telebot.TeleBot(BOT_TOKEN) if BOT_TOKEN else None

user_states = {}

@bot.message_handler(commands=['start', 'help'])
def send_welcome(message):
    bot.reply_to(message, "Welcome to the Accountant & Inventory Bot!\n\nCommands:\n/purchase - Record a purchase invoice\n/sale - Record a sale invoice\n/stock - View current stock levels\n/report YYYY-MM - Generate a monthly GST report")

@bot.message_handler(commands=['purchase'])
def handle_purchase(message):
    user_states[message.chat.id] = 'waiting_for_purchase_image'
    bot.reply_to(message, "Please upload the purchase invoice image.")

@bot.message_handler(commands=['sale'])
def handle_sale(message):
    user_states[message.chat.id] = 'waiting_for_sale_image'
    bot.reply_to(message, "Please upload the sale invoice image.")

@bot.message_handler(content_types=['photo'])
def handle_photo(message):
    state = user_states.get(message.chat.id)
    if state not in ['waiting_for_purchase_image', 'waiting_for_sale_image']:
        return

    transaction_type = 'purchase' if state == 'waiting_for_purchase_image' else 'sale'
    user_states.pop(message.chat.id, None)

    bot.reply_to(message, f"Processing {transaction_type} invoice with AI...")

    # Get the highest resolution image
    file_info = bot.get_file(message.photo[-1].file_id)
    downloaded_file = bot.download_file(file_info.file_path)
    
    # Process with OCR
    try:
        extraction = extract_invoice_items(downloaded_file, "image/jpeg")
    except Exception as e:
        bot.reply_to(message, f"Error extracting data from invoice: {e}")
        return

    # Parse date
    try:
        if extraction.invoice_date:
            tx_date = datetime.strptime(extraction.invoice_date, "%Y-%m-%d").date()
        else:
            tx_date = date.today()
    except Exception:
        tx_date = date.today()

    db = SessionLocal()
    try:
        db_products = get_all_product_names(db)
        confirmation_lines = [f"✓ {transaction_type.capitalize()} Recorded\n"]
        
        for item in extraction.items:
            matched_name, score = match_product(item.product_name, db_products)
            
            if score > 90:
                final_name = matched_name
                prod = db.query(Product).filter(Product.name == final_name).first()
            elif score >= 75:
                # 75-90 -> flag but we use the matched name
                final_name = matched_name
                prod = db.query(Product).filter(Product.name == final_name).first()
                confirmation_lines.append(f"⚠️ Flagged match: '{item.product_name}' matched to '{final_name}' (Score: {score:.1f})")
            else:
                # < 75 -> create new product
                final_name = item.product_name
                prod = Product(name=final_name, last_rate=item.rate)
                db.add(prod)
                db.flush()
                db_products.append(final_name) # update memory cache
                confirmation_lines.append(f"✨ Created new product: '{final_name}'")

            # Create Transaction
            tx = Transaction(
                product_id=prod.id,
                transaction_type=transaction_type,
                transaction_date=tx_date,
                quantity=item.quantity,
                rate=item.rate,
                amount=item.amount,
                invoice_image_url=file_info.file_path,
                date_source='extracted' if extraction.invoice_date else 'current'
            )
            db.add(tx)
            
            # Update current_stock
            if transaction_type == 'purchase':
                prod.current_stock += item.quantity
            else:
                prod.current_stock -= item.quantity
                
            sign = "+" if transaction_type == 'purchase' else "-"
            confirmation_lines.append(f"{final_name} {sign}{item.quantity}")

        db.commit()
        
        confirmation_lines.append(f"\nDate: {tx_date.strftime('%d-%b-%Y')}")
        bot.reply_to(message, "\n".join(confirmation_lines))

    except Exception as e:
        db.rollback()
        bot.reply_to(message, f"Database error while saving transaction: {e}")
    finally:
        db.close()

@bot.message_handler(commands=['stock'])
def handle_stock(message):
    db = SessionLocal()
    try:
        stocks = calculate_stock(db)
        if not stocks:
            bot.reply_to(message, "No stock data available.")
            return
            
        lines = ["📦 Current Stock:"]
        for s in stocks:
            if s['stock'] != 0:
                lines.append(f"• {s['product']}: {s['stock']}")
        
        # Split message if it's too long for Telegram (4096 char limit)
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
        bot.reply_to(message, "Usage: /report YYYY-MM (e.g. /report 2026-06)")
        return
        
    year_month = args[1]
    db = SessionLocal()
    try:
        bot.reply_to(message, f"Generating report for {year_month}...")
        report_path = generate_monthly_report(db, year_month)
        
        with open(report_path, 'rb') as f:
            bot.send_document(
                message.chat.id, 
                f, 
                visible_file_name=f"GST_{year_month.replace('-', '_')}.xlsx"
            )
    except Exception as e:
        bot.reply_to(message, f"Error generating report: {e}")
    finally:
        db.close()

def run_bot():
    if bot:
        print("Starting Telegram bot polling...")
        bot.infinity_polling()
    else:
        print("BOT_TOKEN not set, bot will not run.")
