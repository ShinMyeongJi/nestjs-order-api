# E-Commerce Order & Payment API

NestJS 기반 이커머스 주문/결제 시스템 MVP.
엔터프라이즈급 안정성과 확장성을 고려한 백엔드 API 서버.

## Tech Stack

| Category | Technology |
|---|---|
| Framework | NestJS 10.x |
| Language | TypeScript 5.x (strict mode) |
| ORM | Prisma 5.x |
| Database | MySQL 8.x |
| Validation | class-validator, class-transformer |
| Testing | Jest 29.x (Unit Test) |

## Project Structure

```
src/
├── common/                          # 공통 모듈
│   ├── dto/api-response.dto.ts      # 통일된 API 응답 래퍼
│   ├── exceptions/
│   │   ├── business.exception.ts    # 비즈니스 커스텀 예외
│   │   └── error-codes.ts          # 에러 코드 상수
│   ├── filters/
│   │   └── global-exception.filter.ts  # 전역 예외 필터
│   └── interceptors/
│       └── logging.interceptor.ts   # 요청/응답 로깅
├── product/                         # 상품 & 재고 관리
├── order/                           # 주문 생성 & 조회
│   └── order-status.machine.ts      # 주문 상태 머신
├── payment/                         # 결제 처리 (Mock PG)
│   └── payment-gateway.service.ts   # PG 게이트웨이 추상화
└── prisma/                          # Prisma Client 모듈
```

## Setup

### Prerequisites

- Node.js 18+
- MySQL 8.x (또는 Docker)

### Installation

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일에서 DATABASE_URL 수정

# Prisma Client 생성
npx prisma generate

# DB 마이그레이션
npx prisma migrate dev

# 개발 서버 실행
npm run start:dev
```

### Docker로 MySQL 실행

```bash
docker run -d \
  --name ecommerce-mysql \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=ecommerce \
  -p 3306:3306 \
  mysql:8
```

### 환경변수

```env
DATABASE_URL="mysql://root:password@localhost:3306/ecommerce"
PORT=3000
```

---

## API 명세

Base URL: `http://localhost:3000/api/v1`

### 공통 응답 형식

모든 성공 응답은 동일한 래퍼 구조를 따릅니다.

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

모든 에러 응답도 동일한 구조를 따릅니다.

```json
{
  "success": false,
  "errorCode": "PRODUCT_NOT_FOUND",
  "message": "Product not found: abc-123",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/products/abc-123"
}
```

---

### 1. Product API

#### `GET /api/v1/products`

상품 목록을 조회합니다. 생성일 기준 내림차순 정렬.

**Response** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "NestJS 완벽 가이드",
      "description": "NestJS 입문서",
      "price": 35000,
      "stock": 100,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### `GET /api/v1/products/:id`

상품 상세 정보를 조회합니다.

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| id | UUID | 상품 ID |

**Response** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "NestJS 완벽 가이드",
    "description": "NestJS 입문서",
    "price": 35000,
    "stock": 100,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses**

| Status | Error Code | Description |
|---|---|---|
| 404 | PRODUCT_NOT_FOUND | 존재하지 않는 상품 ID |

---

### 2. Order API

#### `POST /api/v1/orders`

주문을 생성합니다. 재고 차감과 주문 생성이 하나의 트랜잭션으로 처리됩니다.

**Request Body**

```json
{
  "idempotencyKey": "client-generated-unique-key-001",
  "items": [
    {
      "productId": "550e8400-e29b-41d4-a716-446655440000",
      "quantity": 2
    },
    {
      "productId": "550e8400-e29b-41d4-a716-446655440001",
      "quantity": 1
    }
  ]
}
```

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| idempotencyKey | string | ✅ | NotEmpty | 중복 주문 방지용 클라이언트 생성 키 |
| items | array | ✅ | MinSize(1) | 주문 항목 목록 |
| items[].productId | UUID | ✅ | IsUUID | 상품 ID |
| items[].quantity | integer | ✅ | Min(1) | 주문 수량 (1 이상) |

**Response** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "order-uuid-001",
    "idempotencyKey": "client-generated-unique-key-001",
    "status": "PENDING",
    "totalAmount": 90000,
    "items": [
      {
        "id": "item-uuid-001",
        "productId": "550e8400-e29b-41d4-a716-446655440000",
        "quantity": 2,
        "unitPrice": 35000
      },
      {
        "id": "item-uuid-002",
        "productId": "550e8400-e29b-41d4-a716-446655440001",
        "quantity": 1,
        "unitPrice": 20000
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Idempotency 동작**: 동일한 `idempotencyKey`로 재요청 시 새 주문을 생성하지 않고 기존 주문을 그대로 반환합니다 (201).

**Error Responses**

| Status | Error Code | Description |
|---|---|---|
| 400 | HTTP_ERROR | DTO 유효성 검증 실패 (빈 items, quantity < 1 등) |
| 404 | PRODUCT_NOT_FOUND | 존재하지 않는 상품 ID가 items에 포함됨 |
| 409 | INSUFFICIENT_STOCK | 요청 수량이 현재 재고보다 많음 |

#### `GET /api/v1/orders/:id`

주문 상세 정보를 조회합니다. 주문 항목(items)이 포함됩니다.

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| id | UUID | 주문 ID |

**Response** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "order-uuid-001",
    "idempotencyKey": "client-generated-unique-key-001",
    "status": "COMPLETED",
    "totalAmount": 90000,
    "items": [
      {
        "id": "item-uuid-001",
        "productId": "550e8400-e29b-41d4-a716-446655440000",
        "quantity": 2,
        "unitPrice": 35000
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses**

| Status | Error Code | Description |
|---|---|---|
| 404 | ORDER_NOT_FOUND | 존재하지 않는 주문 ID |

#### `GET /api/v1/orders`

전체 주문 목록을 조회합니다. 생성일 기준 내림차순 정렬.

**Response** `200 OK` — 주문 배열 반환 (구조는 상세 조회와 동일)

---

### 3. Payment API

#### `POST /api/v1/payments`

주문에 대한 결제를 처리합니다. Mock PG 게이트웨이를 통해 결제를 시도하고, 결과에 따라 주문 상태를 업데이트합니다.

**Request Body**

```json
{
  "orderId": "order-uuid-001"
}
```

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| orderId | UUID | ✅ | IsUUID | 결제할 주문 ID |

**Response** `201 Created` (결제 성공 시)

```json
{
  "success": true,
  "data": {
    "id": "payment-uuid-001",
    "orderId": "order-uuid-001",
    "amount": 90000,
    "status": "APPROVED",
    "transactionId": "TXN-550e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses**

| Status | Error Code | Description |
|---|---|---|
| 400 | HTTP_ERROR | DTO 유효성 검증 실패 |
| 400 | INVALID_ORDER_STATUS | PENDING이 아닌 주문에 결제 시도 (CANCELLED, FAILED 등) |
| 404 | ORDER_NOT_FOUND | 존재하지 않는 주문 ID |
| 409 | ORDER_ALREADY_PAID | 이미 COMPLETED 상태인 주문에 결제 시도 |
| 409 | PAYMENT_ALREADY_PROCESSED | 이미 APPROVED된 결제가 존재하는 주문 |
| 422 | PAYMENT_FAILED | PG사에서 결제 거절 (카드 한도 초과 등) |
| 502 | PAYMENT_GATEWAY_ERROR | PG 게이트웨이 통신 장애 (timeout, connection refused) |

#### `GET /api/v1/payments/order/:orderId`

특정 주문의 결제 이력을 조회합니다. 하나의 주문에 여러 결제 시도(성공/실패)가 있을 수 있습니다.

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| orderId | UUID | 주문 ID |

**Response** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "payment-uuid-002",
      "orderId": "order-uuid-001",
      "amount": 90000,
      "status": "APPROVED",
      "transactionId": "TXN-abc123",
      "createdAt": "2024-01-01T00:01:00.000Z"
    },
    {
      "id": "payment-uuid-001",
      "orderId": "order-uuid-001",
      "amount": 90000,
      "status": "FAILED",
      "transactionId": null,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "timestamp": "2024-01-01T00:01:00.000Z"
}
```

---

## 에러 코드 전체 목록

| Error Code | HTTP Status | Description |
|---|---|---|
| `PRODUCT_NOT_FOUND` | 404 | 상품을 찾을 수 없음 |
| `INSUFFICIENT_STOCK` | 409 | 재고 부족 |
| `ORDER_NOT_FOUND` | 404 | 주문을 찾을 수 없음 |
| `INVALID_ORDER_STATUS` | 400 | 허용되지 않는 주문 상태 전이 |
| `ORDER_ALREADY_PAID` | 409 | 이미 결제 완료된 주문 |
| `PAYMENT_ALREADY_PROCESSED` | 409 | 이미 승인된 결제 존재 |
| `PAYMENT_FAILED` | 422 | PG사 결제 거절 |
| `PAYMENT_GATEWAY_ERROR` | 502 | PG 게이트웨이 통신 장애 |
| `HTTP_ERROR` | 400 | DTO 유효성 검증 실패 등 NestJS 기본 예외 |
| `INTERNAL_ERROR` | 500 | 예상치 못한 서버 에러 |

---

## 주문 상태 머신 (State Machine)

주문 상태는 정해진 규칙에 따라서만 전이됩니다. 허용되지 않은 전이 시도 시 `INVALID_ORDER_STATUS` 에러가 반환됩니다.

```
                    ┌─────────────┐
                    │   PENDING   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌───────────┐ ┌────────┐ ┌───────────┐
        │ COMPLETED │ │ FAILED │ │ CANCELLED │
        └───────────┘ └───┬────┘ └───────────┘
                           │          (최종 상태)
                           ▼
                      ┌─────────┐
                      │ PENDING │  ← 결제 재시도
                      └─────────┘
```

| From | To | Trigger |
|---|---|---|
| PENDING | COMPLETED | 결제 성공 |
| PENDING | FAILED | 결제 실패 |
| PENDING | CANCELLED | 사용자 취소 |
| FAILED | PENDING | 결제 재시도 |

`COMPLETED`, `CANCELLED`는 최종 상태로 더 이상 전이할 수 없습니다.

---

## 핵심 설계 결정

### 1. Atomic Stock Update (재고 동시성 제어)

```sql
UPDATE products SET stock = stock - :quantity
WHERE id = :productId AND stock >= :quantity
```

애플리케이션 레벨 락 없이 DB의 `WHERE` 조건으로 동시성을 제어합니다. 조건 불일치 시 `affected rows = 0`을 반환하여 재고 부족을 감지합니다.

### 2. Idempotency Key (중복 주문 방지)

클라이언트가 생성한 고유 키를 `idempotencyKey` 필드에 저장합니다. 동일 키로 재요청 시 새 주문을 생성하지 않고 기존 주문을 반환하여 네트워크 재시도에 안전합니다.

### 3. Prisma Interactive Transaction

주문 생성 시 `상품 조회 → 재고 차감 → 주문 생성`을, 결제 시 `결제 기록 → 상태 전이 → (실패 시) 재고 복원`을 하나의 트랜잭션으로 묶어 원자성을 보장합니다. 콜백 내 예외 발생 시 자동 롤백됩니다.

### 4. 가격 스냅샷 (unitPrice)

주문 항목에 주문 시점의 단가를 별도 저장합니다. 이후 상품 가격이 변경되어도 기존 주문의 금액이 영향받지 않습니다.

### 5. 금액은 정수(Int)로 저장

부동소수점 오차를 방지하기 위해 모든 금액을 원(₩) 단위 정수로 저장합니다.

---

## Testing

```bash
npm test              # 단위 테스트 실행
npm run test:cov      # 커버리지 포함 실행
```

- 60개 테스트 케이스, 96.95% 커버리지
- 모든 비즈니스 로직(Service 레이어)에 대한 Unit Test
- 엣지 케이스: 재고 부족, 중복 주문, 중복 결제, 상태 전이 위반, PG 장애 등
- `jest.fn()` 기반 Mocking으로 DB 의존성 없이 테스트
