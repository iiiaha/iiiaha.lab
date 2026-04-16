# Supabase DB Schema

> 자동 생성됨 (2026-04-16). API 개발 시 반드시 참조할 것.
> 특히 NOT NULL 컬럼은 INSERT 시 누락하면 500 에러 발생.

## products
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NOT NULL | gen_random_uuid() |
| slug | text | NOT NULL | |
| name | text | NOT NULL | |
| type | text | NOT NULL | |
| platform | text | NULL | |
| price | integer | NOT NULL | |
| description | text | NULL | |
| version | text | NULL | |
| compatibility | text | NULL | |
| thumbnail_url | text | NULL | |
| file_key | text | NULL | |
| created_at | timestamptz | NULL | now() |
| description_ko | text | NULL | |
| sort_order | integer | NULL | 0 |
| discount_start | timestamptz | NULL | |
| discount_end | timestamptz | NULL | |
| is_active | boolean | NULL | true |
| original_price | integer | NULL | |
| discount_percent | integer | NULL | 0 |
| subtitle | text | NULL | |
| badge | text | NULL | |

## orders
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NOT NULL | gen_random_uuid() |
| user_id | uuid | NOT NULL | |
| product_id | uuid | NOT NULL | |
| payment_key | text | NULL | |
| amount | integer | NOT NULL | |
| status | text | NULL | pending |
| created_at | timestamptz | NULL | now() |
| subscription_id | uuid | NULL | |
| download_acknowledged_at | timestamptz | NULL | |

## licenses
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NOT NULL | gen_random_uuid() |
| **order_id** | **uuid** | **NOT NULL** | |
| user_id | uuid | NOT NULL | |
| product_id | uuid | NOT NULL | |
| license_key | text | NOT NULL | |
| hwid | text | NULL | |
| status | text | NULL | active |
| activated_at | timestamptz | NULL | |
| created_at | timestamptz | NULL | now() |
| subscription_id | uuid | NULL | |

## subscriptions
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NOT NULL | gen_random_uuid() |
| user_id | uuid | NOT NULL | |
| plan | text | NOT NULL | |
| status | text | NOT NULL | active |
| started_at | timestamptz | NOT NULL | now() |
| expires_at | timestamptz | NOT NULL | |
| created_at | timestamptz | NOT NULL | now() |
| billing_key | text | NULL | |
| customer_key | text | NULL | |
| amount | integer | NULL | |
| cancel_at_period_end | boolean | NOT NULL | false |
| canceled_at | timestamptz | NULL | |
| last_payment_key | text | NULL | |
| last_charged_at | timestamptz | NULL | |

## admins
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| user_id | uuid | NOT NULL | |
| created_at | timestamptz | NULL | now() |

## coupons
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NOT NULL | gen_random_uuid() |
| code | text | NOT NULL | |
| discount_type | text | NOT NULL | percent |
| discount_value | numeric | NOT NULL | |
| min_amount | numeric | NULL | |
| max_uses | integer | NULL | |
| used_count | integer | NULL | 0 |
| is_active | boolean | NULL | true |
| starts_at | timestamptz | NULL | |
| expires_at | timestamptz | NULL | |
| created_at | timestamptz | NULL | now() |
