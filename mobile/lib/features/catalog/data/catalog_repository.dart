import 'package:capricho_store/core/network/api_client.dart';
import 'package:capricho_store/core/network/api_exception.dart';
import 'package:capricho_store/features/catalog/domain/catalog_models.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final catalogRepositoryProvider = Provider<CatalogRepository>(
  (ref) => CatalogRepository(ref.watch(dioProvider)),
);

class CatalogRepository {
  const CatalogRepository(this._dio);
  final Dio _dio;

  Future<ProductPage> products(CatalogQuery query) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/products',
        queryParameters: query.toQuery(),
      );
      return ProductPage.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Product> product(int id) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/products/$id');
      return Product.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<CategoryItem>> categories() async {
    try {
      final response = await _dio.get<List<dynamic>>('/categories');
      return (response.data ?? const [])
          .map((item) => CategoryItem.fromJson(item as Map<String, dynamic>))
          .where((cat) => cat.active)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<BrandItem>> brands() async {
    try {
      final response = await _dio.get<List<dynamic>>('/brands');
      return (response.data ?? const [])
          .map((item) => BrandItem.fromJson(item as Map<String, dynamic>))
          .where((brand) => brand.active)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<SizeItem>> sizes() async {
    try {
      final response = await _dio.get<List<dynamic>>('/sizes');
      return (response.data ?? const [])
          .map((item) => SizeItem.fromJson(item as Map<String, dynamic>))
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<ColorItem>> colors() async {
    try {
      final response = await _dio.get<List<dynamic>>('/colors');
      return (response.data ?? const [])
          .map((item) => ColorItem.fromJson(item as Map<String, dynamic>))
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<SeasonItem>> seasons() async {
    try {
      final response = await _dio.get<List<dynamic>>('/seasons');
      return (response.data ?? const [])
          .map((item) => SeasonItem.fromJson(item as Map<String, dynamic>))
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<ProductImage>> productImages(int productId) async {
    try {
      final response = await _dio.get<List<dynamic>>(
        '/products/$productId/images',
      );
      return (response.data ?? const [])
          .map((item) => ProductImage.fromJson(item as Map<String, dynamic>))
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<ProductVariant>> productVariants(int productId) async {
    try {
      final response = await _dio.get<List<dynamic>>(
        '/products/$productId/variants',
      );
      return (response.data ?? const [])
          .map((item) => ProductVariant.fromJson(item as Map<String, dynamic>))
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<ProductMeasurement>> productMeasurements(int productId) async {
    try {
      final response = await _dio.get<List<dynamic>>(
        '/products/$productId/measurements',
      );
      return (response.data ?? const [])
          .map(
            (item) => ProductMeasurement.fromJson(item as Map<String, dynamic>),
          )
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
