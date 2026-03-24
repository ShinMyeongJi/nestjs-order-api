# E-Commerce Order & Payment API

NestJS 기반 이커머스 주문/결제 시스템 MVP

## Tech Stack

- **Framework**: NestJS (TypeScript)
- **ORM**: Prisma (MySQL)
- **Validation**: class-validator, class-transformer
- **Testing**: Jest

## Architecture

```
src/
├── common/          # Global Exception Filter, Logging Interceptor, DTOs
├── product/         # 상품 조회 & 재고 관리 (Atomic Update)
├── order/           # 주문 생성 & 조회 (Idempotency Key)
├── payment/         # 결제 처리 (Mock PG, Compensating Transaction)
└── prisma/          # Prisma Client Module
```

## Key Features

- **Atomic Stock Update**: DB 레벨 동시성 제어 (`WHERE stock >= quantity`)
- **Idempotency Key**: 중복 주문 방지
- **Prisma Transaction**: 주문-결제-재고를 하나의 원자적 단위로 처리
- **Compensating Transaction**: 결제 실패 시 재고 자동 복원
- **Global Exception Filter**: 비즈니스 에러 코드 기반 구조화된 에러 응답
- **DTO Validation**: class-validator 기반 엄격한 입력 검증

## Setup

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

## API Endpoints

| Method | Endpoint                      | Description    |
|--------|-------------------------------|----------------|
| GET    | /api/v1/products              | 상품 목록 조회 |
| GET    | /api/v1/products/:id          | 상품 상세 조회 |
| POST   | /api/v1/orders                | 주문 생성      |
| GET    | /api/v1/orders                | 주문 목록 조회 |
| GET    | /api/v1/orders/:id            | 주문 상세 조회 |
| POST   | /api/v1/payments              | 결제 처리      |
| GET    | /api/v1/payments/order/:id    | 주문별 결제 조회 |

## Testing

```bash
npm test              # 단위 테스트 실행
npm run test:cov      # 커버리지 포함 실행
```
