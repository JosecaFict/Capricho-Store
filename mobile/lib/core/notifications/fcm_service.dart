import 'dart:async';
import 'dart:developer' as developer;

import 'package:capricho_store/features/commerce/data/commerce_api.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {}
  developer.log(
    'Notificación recibida en segundo plano: ${message.messageId}',
    name: 'FCM',
  );
}

class FcmService {
  static final FcmService _instance = FcmService._internal();
  factory FcmService() => _instance;
  FcmService._internal();

  String? _fcmToken;
  String? get fcmToken => _fcmToken;

  final _notificationTapController = StreamController<String>.broadcast();
  Stream<String> get onNotificationTap => _notificationTapController.stream;

  final _foregroundMessageController =
      StreamController<RemoteMessage>.broadcast();
  Stream<RemoteMessage> get onForegroundMessage =>
      _foregroundMessageController.stream;

  Future<void> initialize() async {
    try {
      await Firebase.initializeApp();
      developer.log('Firebase Core inicializado correctamente', name: 'FCM');

      final messaging = FirebaseMessaging.instance;

      // Solicitar permisos de notificación
      final settings = await messaging.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );

      developer.log(
        'Permiso de notificaciones: ${settings.authorizationStatus}',
        name: 'FCM',
      );

      // Obtener el token de FCM
      _fcmToken = await messaging.getToken();
      if (_fcmToken != null) {
        developer.log('FCM Token obtenido: $_fcmToken', name: 'FCM');
        if (kDebugMode) {
          debugPrint('====================================');
          debugPrint('🔥 FCM Token: $_fcmToken');
          debugPrint('====================================');
        }
      }

      // Escuchar actualizaciones del token
      messaging.onTokenRefresh.listen((newToken) {
        _fcmToken = newToken;
        developer.log('FCM Token actualizado: $newToken', name: 'FCM');
      });

      // Manejar mensajes en primer plano (Foreground)
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        developer.log(
          'Mensaje recibido en primer plano: ${message.notification?.title} - ${message.notification?.body}',
          name: 'FCM',
        );
        _foregroundMessageController.add(message);
      });

      // Manejar interacción al tocar una notificación cuando la app está abierta o minimizada
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        developer.log(
          'Usuario tocó la notificación: ${message.data}',
          name: 'FCM',
        );
        final route = extractRoute(message);
        if (route != null) {
          _notificationTapController.add(route);
        }
      });

      // Notificación que abrió la app desde estado cerrado (Cold start)
      final initialMessage = await messaging.getInitialMessage();
      if (initialMessage != null) {
        developer.log(
          'App iniciada desde notificación: ${initialMessage.data}',
          name: 'FCM',
        );
        final route = extractRoute(initialMessage);
        if (route != null) {
          Future.delayed(const Duration(milliseconds: 600), () {
            _notificationTapController.add(route);
          });
        }
      }

      // Registrar manejador de segundo plano
      FirebaseMessaging.onBackgroundMessage(
        _firebaseMessagingBackgroundHandler,
      );
    } catch (e, stack) {
      developer.log(
        'Error inicializando Firebase / FCM (no crítico): $e',
        error: e,
        stackTrace: stack,
        name: 'FCM',
      );
    }
  }

  /// Sincroniza el token del dispositivo con el backend
  Future<void> syncTokenWithBackend(CommerceApi api) async {
    final token = _fcmToken;
    if (token == null || token.isEmpty) return;

    try {
      final platform =
          defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';
      await api.registerDeviceToken(
        token: token,
        platform: platform,
        deviceInfo: '${defaultTargetPlatform.name.toUpperCase()} Device',
      );
      developer.log(
        'Token FCM registrado en backend correctamente',
        name: 'FCM',
      );
    } catch (e) {
      developer.log(
        'No se pudo sincronizar token FCM con backend: $e',
        name: 'FCM',
      );
    }
  }

  static String? extractRoute(RemoteMessage message) {
    final data = message.data;
    if (data.containsKey('route') &&
        data['route'] != null &&
        data['route'].toString().isNotEmpty) {
      return data['route'].toString();
    }
    final type = (data['type'] ?? '').toString().toUpperCase();
    final id = (data['id'] ?? '').toString();

    if (type.contains('ORDER') ||
        type.contains('PEDIDO') ||
        type.contains('VENTA')) {
      return id.isNotEmpty ? '/pedidos/$id' : '/pedidos';
    }
    if (type.contains('RESERV')) {
      return '/reservas';
    }
    if (type.contains('NOTIF')) {
      return '/notificaciones';
    }
    return '/notificaciones';
  }
}
