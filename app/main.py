import threading
from fastapi import FastAPI
from app.api import routers
from app.telegram.bot import run_bot
from app.utils.logger import logger

app = FastAPI(title="Inventory OCR Automation System")

# Mount API routers
app.include_router(routers.router)

@app.on_event("startup")
def startup_event():
    """
    Launch the Telegram Bot polling loop in a daemon thread.
    """
    logger.info("Starting FastAPI backend...")
    bot_thread = threading.Thread(target=run_bot, daemon=True)
    bot_thread.start()
