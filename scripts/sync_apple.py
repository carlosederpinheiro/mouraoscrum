import os
import datetime
import caldav
from supabase import create_client

APPLE_URL = "https://caldav.icloud.com/"
APPLE_EMAIL = os.environ.get("APPLE_EMAIL", "mourao.paulo@icloud.com")
APPLE_PASSWORD = os.environ.get("APPLE_APP_PASSWORD", "dqwu-ifmn-yzvs-kcyb")
CALENDAR_NAME = "Mourão Consultoria Econômica"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://enamvoamthbfimtsvgqa.supabase.co")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_KEY")
    or os.environ.get("VITE_SUPABASE_ANON_KEY", "sb_publishable_CpzqeLlInSe81L1Sq46rQQ_NJSmTnP1")
)

def main():
    print("[*] Conectando ao CalDAV Apple e Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    client = caldav.DAVClient(url=APPLE_URL, username=APPLE_EMAIL, password=APPLE_PASSWORD)
    
    principal = client.principal()
    calendar = None
    for cal in principal.calendars():
        if cal.name.strip() == CALENDAR_NAME:
            calendar = cal
            break
            
    if not calendar:
        raise ValueError(f"[-] Erro: Calendário '{CALENDAR_NAME}' não foi encontrado.")

    print(f"[+] Calendário selecionado: '{CALENDAR_NAME}'")

    # Busca eventos entre 30 dias atrás e 90 dias à frente
    now = datetime.datetime.now(datetime.timezone.utc)
    start_dt = now - datetime.timedelta(days=30)
    end_dt = now + datetime.timedelta(days=90)
    
    print(f"[*] Buscando eventos entre {start_dt.date()} e {end_dt.date()}...")
    events = calendar.search(start=start_dt, end=end_dt, event=True, expand=True)

    payload_map = {}
    apple_uids = set()

    for ev in events:
        ical = ev.icalendar_instance
        for comp in ical.subcomponents:
            if comp.name == "VEVENT":
                uid = str(comp.get("uid"))
                title = str(comp.get("summary", "Sem título"))
                desc = str(comp.get("description", "")) if comp.get("description") else None
                loc = str(comp.get("location", "")) if comp.get("location") else None
                
                dtstart_raw = comp.get("dtstart")
                if not dtstart_raw:
                    continue
                dtstart = dtstart_raw.dt
                
                dtend_raw = comp.get("dtend")
                dtend = dtend_raw.dt if dtend_raw else dtstart
                
                all_day = not isinstance(dtstart, datetime.datetime)
                
                if all_day:
                    start_iso = datetime.datetime(dtstart.year, dtstart.month, dtstart.day, 0, 0, 0, tzinfo=datetime.timezone.utc).isoformat()
                    end_iso = datetime.datetime(dtend.year, dtend.month, dtend.day, 23, 59, 59, tzinfo=datetime.timezone.utc).isoformat()
                else:
                    start_iso = dtstart.isoformat()
                    end_iso = dtend.isoformat()

                # Para eventos recorrentes, compõe o ID único com o recurrence-id ou start_time
                rec_raw = comp.get("recurrence-id")
                if rec_raw:
                    rec_val = rec_raw.dt.strftime("%Y%m%dT%H%M%S") if hasattr(rec_raw.dt, "strftime") else str(rec_raw.dt)
                    event_id = f"{uid}_{rec_val}"
                else:
                    event_id = uid

                apple_uids.add(event_id)

                payload_map[event_id] = {
                    "id": event_id,
                    "title": title,
                    "description": desc,
                    "location": loc,
                    "start_time": start_iso,
                    "end_time": end_iso,
                    "all_day": all_day,
                    "calendar_name": CALENDAR_NAME,
                    "source": "apple",
                    "status": "CONFIRMED",
                    "updated_at": now.isoformat()
                }

    payload = list(payload_map.values())

    if payload:
        supabase.table("calendar_events").upsert(payload).execute()
        print(f"[+] Sucesso: {len(payload)} eventos sincronizados no Supabase!")
    else:
        print("[-] Nenhum evento encontrado no período.")

    # Reconciliação: remove eventos que foram apagados no iPhone
    try:
        res = (
            supabase.table("calendar_events")
            .select("id")
            .eq("source", "apple")
            .gte("start_time", start_dt.isoformat())
            .lte("end_time", end_dt.isoformat())
            .execute()
        )
        db_uids = {row["id"] for row in (res.data or [])}
        orphaned_uids = db_uids - apple_uids

        if orphaned_uids:
            print(f"[*] Detectados {len(orphaned_uids)} eventos excluídos na Apple. Limpando do Supabase...")
            for del_uid in orphaned_uids:
                supabase.table("calendar_events").delete().eq("id", del_uid).execute()
            print(f"[+] Reconciliação finalizada: {len(orphaned_uids)} eventos obsoletos removidos.")
    except Exception as e:
        print(f"[!] Reconciliação de exclusões: {e}")

if __name__ == "__main__":
    main()
