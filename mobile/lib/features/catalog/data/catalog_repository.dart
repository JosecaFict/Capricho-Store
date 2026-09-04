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
}
