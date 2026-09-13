import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

class GeocodedAddress {
  final String? road;
  final String? zone;
  final String? displayName;
  final double latitude;
  final double longitude;

  const GeocodedAddress({
    this.road,
    this.zone,
    this.displayName,
    required this.latitude,
    required this.longitude,
  });

  String get summary {
    if (road != null && zone != null) {
      return '$road, $zone';
    }
    return road ?? zone ?? displayName ?? 'Ubicación seleccionada';
  }
}

class GeocodingService {
  GeocodingService._();

  static final Dio _dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(milliseconds: 3500),
      receiveTimeout: const Duration(milliseconds: 3500),
      headers: {
        'User-Agent': 'CaprichoStoreApp/1.0 (contact@caprichostore.bo)',
        'Accept': 'application/json',
      },
    ),
  );

  /// Obtiene el nombre de la calle y barrio a partir de coordenadas GPS.
  /// Si la solicitud falla o no hay conexión, retorna null de forma segura sin lanzar excepción.
  static Future<GeocodedAddress?> reverseGeocode(double lat, double lng) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        'https://nominatim.openstreetmap.org/reverse',
        queryParameters: {
          'lat': lat,
          'lon': lng,
          'format': 'json',
          'addressdetails': 1,
        },
      );

      final data = response.data;
      if (data == null) return null;

      final address = data['address'] as Map<String, dynamic>?;
      if (address == null) return null;

      // Buscar el nombre de la calle/avenida
      final road = address['road'] as String? ??
          address['pedestrian'] as String? ??
          address['residential'] as String? ??
          address['street'] as String? ??
          address['footway'] as String?;

      // Buscar el barrio o zona
      final zone = address['suburb'] as String? ??
          address['neighbourhood'] as String? ??
          address['city_district'] as String? ??
          address['quarter'] as String?;

      final displayName = data['display_name'] as String?;

      return GeocodedAddress(
        road: road,
        zone: zone,
        displayName: displayName,
        latitude: lat,
        longitude: lng,
      );
    } catch (e) {
      debugPrint('[GeocodingService] Reverse geocode error (silencioso): $e');
      return null;
    }
  }
}
