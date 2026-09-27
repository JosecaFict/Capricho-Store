import 'package:capricho_store/core/network/api_client.dart';
import 'package:capricho_store/core/network/api_exception.dart';
import 'package:capricho_store/features/fitting/domain/tryon_models.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final tryOnRepositoryProvider = Provider<TryOnRepository>((ref) {
  return TryOnRepository(ref.watch(dioProvider));
});

class TryOnRepository {
  const TryOnRepository(this._dio);
  final Dio _dio;

  Future<TryOnQuota> getQuota() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/try-on/quota');
      return TryOnQuota.fromJson(response.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<TryOnTaskCreateResponse> createTask({
    required int productId,
    required String imagePath,
    int? colorId,
    String? colorName,
  }) async {
    try {
      final fileName = imagePath.split(RegExp(r'[/\\]')).last;
      final formData = FormData.fromMap({
        'product_id': productId,
        if (colorId != null) 'color_id': colorId,
        if (colorName != null && colorName.isNotEmpty) 'color_name': colorName,
        'file': await MultipartFile.fromFile(
          imagePath,
          filename: fileName.isNotEmpty ? fileName : 'cliente.jpg',
        ),
      });

      final response = await _dio.post<Map<String, dynamic>>(
        '/try-on/tasks',
        data: formData,
      );
      return TryOnTaskCreateResponse.fromJson(response.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<TryOnTask> getTaskStatus(String taskId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/try-on/tasks/$taskId');
      return TryOnTask.fromJson(response.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
