from apscheduler.schedulers.background import BackgroundScheduler
import atexit


def start_scheduler(func, hours=24):
    scheduler = BackgroundScheduler()
    # run immediately once, then schedule
    try:
        func()
    except Exception as e:
        print("Initial scheduled run failed:", e)
    scheduler.add_job(func, 'interval', hours=hours, id='retrain_job', replace_existing=True)
    scheduler.start()
    atexit.register(lambda: scheduler.shutdown(wait=False))
    print(f"Scheduler started: retrain every {hours} hours")
    return scheduler
