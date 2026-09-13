from datetime import UTC, date, datetime, time, timedelta


def add_business_days(start_date: date, n_days: int) -> date:
    """
    Adds `n_days` business days (Monday to Friday) starting from `start_date`.
    Saturdays (5) and Sundays (6) are excluded.
    """
    cur = start_date
    added = 0
    while added < n_days:
        cur += timedelta(days=1)
        if cur.weekday() < 5:
            added += 1
    return cur


def get_return_deadline(sale_dt: datetime, max_days: int = 5) -> datetime:
    """
    Calculates the exact deadline datetime (23:59:59.999999 UTC of the N-th business day)
    for returning garments from a sale made at `sale_dt`.
    """
    sale_date = sale_dt.date()
    deadline_date = add_business_days(sale_date, max_days)
    return datetime.combine(deadline_date, time(23, 59, 59, 999999, tzinfo=UTC))


def calculate_business_days_elapsed(sale_dt: datetime, current_dt: datetime | None = None) -> int:
    """
    Calculates how many business days have elapsed between sale_dt and current_dt.
    If current_dt is on the same day as sale_dt, returns 0.
    """
    if current_dt is None:
        current_dt = datetime.now(UTC)

    start_date = sale_dt.date()
    end_date = current_dt.date()

    if end_date <= start_date:
        return 0

    elapsed = 0
    cur = start_date + timedelta(days=1)
    while cur <= end_date:
        if cur.weekday() < 5:
            elapsed += 1
        cur += timedelta(days=1)

    return elapsed


def is_return_window_valid(
    sale_dt: datetime, max_days: int = 5, current_dt: datetime | None = None
) -> tuple[bool, int, datetime]:
    """
    Checks if a sale is still eligible for return under the max_days business days policy.
    Returns:
        (is_eligible: bool, remaining_business_days: int, deadline_datetime: datetime)
    """
    if current_dt is None:
        current_dt = datetime.now(UTC)

    deadline = get_return_deadline(sale_dt, max_days)
    elapsed = calculate_business_days_elapsed(sale_dt, current_dt)
    remaining = max(0, max_days - elapsed)
    is_valid = current_dt <= deadline

    return is_valid, remaining, deadline
