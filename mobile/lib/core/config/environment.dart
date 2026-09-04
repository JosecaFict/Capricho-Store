import 'package:flutter/foundation.dart';

abstract final class Environment {
  static const _definedUrl = String.fromEnvironment('API_BASE_URL');

  static String get apiBaseUrl {
    if (_definedUrl.isNotEmpty) return _definedUrl;
    if (kIsWeb) return 'http://127.0.0.1:8000/api/v1';
    return defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:8000/api/v1'
        : 'http://127.0.0.1:8000/api/v1';
  }
}
