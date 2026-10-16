from fastapi import FastAPI, Request, HTTPException
import os
import datetime
import caldav

app = FastAPI()

APPLE_URL = "https://caldav.icloud.com/"
APPLE_EMAIL = os.environ.get("APPLE_EMAIL", "mourao.paulo@icloud.com")
APPLE_PASSWORD = os.environ.get("APPLE_APP_PASSWORD", "dqwu-ifmn-yzvs-kcyb")
CALENDAR_NAME = "Mourão Consultoria Econômica"
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")

def get_apple_calendar():
    client = caldav.DAVClient(url=APPLE_URL, username=APPLE_EMAIL, password=APPLE_PASSWORD)
    principal = client.principal()
    for cal in principal.calendars():
        if cal.name.strip() == CALENDAR_NAME:
            return cal
    raise ValueError(f"Calendário '{CALENDAR_NAME}' não encontrado.")

@app.post("/api/webhook")
@app.post("/")
async def supabase_webhook(request: Request):
    # Proteção com chave secreta opcional
    if WEBHOOK_SECRET:
        secret_header = request.headers.get("x-webhook-secret")
        if secret_header != WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized")

    payload = await request.json()
    event_type = payload.get("type") # INSERT, UPDATE, DELETE
    record = payload.get("record") or {}
    old_record = payload.get("old_record") or {}

    # Define qual registro analisar com base no tipo de operação
    target_record = record if event_type != "DELETE" else old_record

    # Evita loop infinito: se o evento veio da Apple, não reenviamos
    if target_record.get("source") == "apple":
        return {"status": "ignored", "reason": "source is apple"}

    calendar = get_apple_calendar()

    try:
        if event_type == "INSERT":
            calendar.save_event(
                uid=target_record["id"],
                summary=target_record["title"],
                dtstart=datetime.datetime.fromisoformat(target_record["start_time"]),
                dtend=datetime.datetime.fromisoformat(target_record["end_time"]),
                description=target_record.get("description") or "",
                location=target_record.get("location") or ""
            )
        elif event_type == "UPDATE":
            event_uid = target_record["id"]
            updated = False
            try:
                event_url = f"{str(calendar.url).rstrip('/')}/{event_uid}.ics"
                event = calendar.event(url=event_url)
                vevent = event.icalendar_instance.subcomponents[0]
                vevent["summary"] = target_record["title"]
                vevent["dtstart"] = datetime.datetime.fromisoformat(target_record["start_time"])
                vevent["dtend"] = datetime.datetime.fromisoformat(target_record["end_time"])
                if target_record.get("description"):
                    vevent["description"] = target_record["description"]
                if target_record.get("location"):
                    vevent["location"] = target_record["location"]
                event.save()
                updated = True
            except Exception:
                pass

            if not updated:
                calendar.save_event(
                    uid=event_uid,
                    summary=target_record["title"],
                    dtstart=datetime.datetime.fromisoformat(target_record["start_time"]),
                    dtend=datetime.datetime.fromisoformat(target_record["end_time"]),
                    description=target_record.get("description") or "",
                    location=target_record.get("location") or ""
                )
        elif event_type == "DELETE":
            event_uid = target_record["id"]
            deleted = False
            try:
                event_url = f"{str(calendar.url).rstrip('/')}/{event_uid}.ics"
                calendar.client.delete(event_url)
                deleted = True
            except Exception:
                pass

            if not deleted:
                try:
                    now = datetime.datetime.now(datetime.timezone.utc)
                    events = calendar.search(start=now - datetime.timedelta(days=30), end=now + datetime.timedelta(days=90), event=True)
                    for ev in events:
                        if ev.icalendar_instance.subcomponents[0].get('uid') == event_uid:
                            ev.delete()
                            break
                except Exception as e:
                    print(f"Aviso ao deletar no CalDAV: {e}")

        return {"status": "success", "action": event_type, "id": target_record.get("id")}
    except Exception as e:
        return {"status": "error", "message": str(e)}
