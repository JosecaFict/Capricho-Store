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

  Future<ProductPage> products(CatalogQuery query) async {  // [CU-04] Consultar catálogo con filtros
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

  Future<Product> product(int id, {int? branchId}) async {  // [CU-04] Ver detalle de prenda y stock por sucursal
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/products/$id',
        queryParameters: {'sucursal': ?branchId},
      );
      return Product.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<BranchItem>> branches() async {  // [CU-03] Listar sucursales activas
    try {
      final response = await _dio.get<List<dynamic>>('/branches');
      return (response.data ?? const [])
          .map((item) => BranchItem.fromJson(item as Map<String, dynamic>))
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<CategoryItem>> categories() async {  // [CU-04] Listar categorías
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

  Future<List<BrandItem>> brands() async {  // [CU-04] Listar marcas
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

  Future<List<SizeItem>> sizes() async {  // [CU-04] Listar tallas
    try {
      final response = await _dio.get<List<dynamic>>('/sizes');
      return (response.data ?? const [])
          .map((item) => SizeItem.fromJson(item as Map<String, dynamic>))
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<ColorItem>> colors() async {  // [CU-04] Listar colores
    try {
      final response = await _dio.get<List<dynamic>>('/colors');
      return (response.data ?? const [])
          .map((item) => ColorItem.fromJson(item as Map<String, dynamic>))
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<SeasonItem>> seasons() async {  // [CU-04] Listar temporadas
    try {
      final response = await _dio.get<List<dynamic>>('/seasons');
      return (response.data ?? const [])
          .map((item) => SeasonItem.fromJson(item as Map<String, dynamic>))
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<ProductImage>> productImages(int productId) async {  // [CU-04] Consultar imágenes de prenda
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

  Future<List<ProductVariant>> productVariants(  // [CU-04] Consultar variantes y stock
    int productId, {
    int? branchId,
  }) async {
    try {
      final response = await _dio.get<List<dynamic>>(
        '/products/$productId/variants',
        queryParameters: {'sucursal': ?branchId},
      );
      return (response.data ?? const [])
          .map((item) => ProductVariant.fromJson(item as Map<String, dynamic>))
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<ProductMeasurement>> productMeasurements(int productId) async {  // [CU-18] Consultar medidas de patronaje para probador AR
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
