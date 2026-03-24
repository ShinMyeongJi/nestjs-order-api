import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common';
import { ErrorCodes } from '../common/exceptions/error-codes';

describe('ProductService', () => {
  let service: ProductService;
  let prisma: jest.Mocked<PrismaService>;

  const mockProduct = {
    id: 'product-1',
    name: 'Test Product',
    description: 'A test product',
    price: 10000,
    stock: 50,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const mockPrisma = {
      product: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    prisma = module.get(PrismaService);
  });

  describe('findAll', () => {
    it('should return all products', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([mockProduct]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('product-1');
      expect(result[0].name).toBe('Test Product');
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no products exist', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('should return a product by id', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      const result = await service.findById('product-1');

      expect(result.id).toBe('product-1');
      expect(result.price).toBe(10000);
    });

    it('should throw PRODUCT_NOT_FOUND when product does not exist', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        BusinessException,
      );

      try {
        await service.findById('non-existent');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).errorCode).toBe(
          ErrorCodes.PRODUCT_NOT_FOUND,
        );
      }
    });
  });

  describe('decreaseStock', () => {
    it('should decrease stock when sufficient quantity available', async () => {
      (prisma.product.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await expect(
        service.decreaseStock('product-1', 5),
      ).resolves.toBeUndefined();

      expect(prisma.product.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'product-1',
          stock: { gte: 5 },
        },
        data: {
          stock: { decrement: 5 },
        },
      });
    });

    it('should throw INSUFFICIENT_STOCK when stock is not enough', async () => {
      // count: 0은 WHERE 조건 불일치 = 재고 부족
      (prisma.product.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(service.decreaseStock('product-1', 100)).rejects.toThrow(
        BusinessException,
      );

      try {
        await service.decreaseStock('product-1', 100);
      } catch (error) {
        expect((error as BusinessException).errorCode).toBe(
          ErrorCodes.INSUFFICIENT_STOCK,
        );
      }
    });

    it('should throw INSUFFICIENT_STOCK when product does not exist', async () => {
      (prisma.product.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(
        service.decreaseStock('non-existent', 1),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('restoreStock', () => {
    it('should restore stock by incrementing quantity', async () => {
      (prisma.product.update as jest.Mock).mockResolvedValue({
        ...mockProduct,
        stock: 55,
      });

      await service.restoreStock('product-1', 5);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: { stock: { increment: 5 } },
      });
    });
  });
});
