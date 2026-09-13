from datetime import UTC, date, datetime

from app.modules.commerce.business_days import (
    add_business_days,
    calculate_business_days_elapsed,
    get_return_deadline,
    is_return_window_valid,
)


def test_add_business_days_midweek() -> None:
    # Wednesday 2026-09-02 + 5 business days:
    # Day 1: Thu Sep 03
    # Day 2: Fri Sep 04
    # Sat/Sun skipped
    # Day 3: Mon Sep 07
    # Day 4: Tue Sep 08
    # Day 5: Wed Sep 09
    start = date(2026, 9, 2)
    result = add_business_days(start, 5)
    assert result == date(2026, 9, 9)


def test_add_business_days_friday_sale() -> None:
    # Friday 2026-09-04 + 5 business days:
    # Sat Sep 05 & Sun Sep 06 skipped
    # Day 1: Mon Sep 07
    # Day 2: Tue Sep 08
    # Day 3: Wed Sep 09
    # Day 4: Thu Sep 10
    # Day 5: Fri Sep 11
    start = date(2026, 9, 4)
    result = add_business_days(start, 5)
    assert result == date(2026, 9, 11)


def test_add_business_days_weekend_sale() -> None:
    # Saturday 2026-09-05 + 5 business days:
    # Day 1: Mon Sep 07
    # Day 2: Tue Sep 08
    # Day 3: Wed Sep 09
    # Day 4: Thu Sep 10
    # Day 5: Fri Sep 11
    start = date(2026, 9, 5)
    result = add_business_days(start, 5)
    assert result == date(2026, 9, 11)


def test_is_return_window_valid_boundary() -> None:
    # Sale on Friday 2026-09-04 14:00 UTC
    sale_dt = datetime(2026, 9, 4, 14, 0, 0, tzinfo=UTC)
    deadline = get_return_deadline(sale_dt, max_days=5)
    assert deadline.date() == date(2026, 9, 11)

    # Check on Friday 2026-09-11 20:00 UTC (within deadline)
    check_valid = datetime(2026, 9, 11, 20, 0, 0, tzinfo=UTC)
    is_valid, remaining, _ = is_return_window_valid(sale_dt, max_days=5, current_dt=check_valid)
    assert is_valid is True
    assert remaining == 0  # 5 days elapsed, last day

    # Check on Saturday 2026-09-12 08:00 UTC (expired)
    check_expired = datetime(2026, 9, 12, 8, 0, 0, tzinfo=UTC)
    is_valid, remaining, _ = is_return_window_valid(sale_dt, max_days=5, current_dt=check_expired)
    assert is_valid is False
    assert remaining == 0


def test_calculate_business_days_elapsed() -> None:
    sale_dt = datetime(2026, 9, 4, 10, 0, 0, tzinfo=UTC)  # Friday
    assert calculate_business_days_elapsed(sale_dt, sale_dt) == 0

    sat = datetime(2026, 9, 5, 12, 0, tzinfo=UTC)
    assert calculate_business_days_elapsed(sale_dt, sat) == 0  # Weekend doesn't count

    mon = datetime(2026, 9, 7, 10, 0, tzinfo=UTC)
    assert calculate_business_days_elapsed(sale_dt, mon) == 1

    tue = datetime(2026, 9, 8, 10, 0, tzinfo=UTC)
    assert calculate_business_days_elapsed(sale_dt, tue) == 2
