import 'dart:developer' as developer;

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
      });

      // Manejar interacción al tocar una notificación cuando la app está abierta o minimizada
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        developer.log(
          'Usuario tocó la notificación: ${message.data}',
          name: 'FCM',
        );
      });

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
}
