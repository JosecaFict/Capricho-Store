import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/commerce/data/commerce_api.dart';
import 'package:capricho_store/features/commerce/domain/commerce_models.dart';
import 'package:capricho_store/features/commerce/presentation/commerce_controller.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

class CheckoutCompleteScreen extends ConsumerStatefulWidget {
  final String? sessionId;
  final String? status;

  const CheckoutCompleteScreen({
    super.key,
    this.sessionId,
    this.status,
  });

  @override
  ConsumerState<CheckoutCompleteScreen> createState() =>
      _CheckoutCompleteScreenState();
}

class _CheckoutCompleteScreenState
    extends ConsumerState<CheckoutCompleteScreen> {
  final _currency = NumberFormat.currency(
    locale: 'es_BO',
    symbol: 'Bs ',
    decimalDigits: 2,
  );

  bool _loading = true;
  String? _errorMessage;
  StripeCheckoutStatusResponse? _statusResponse;

  @override
  void initState() {
    super.initState();
    _handleArrival();
  }

  Future<void> _handleArrival() async {
    // 1. Intentar cerrar el navegador interno si estaba abierto
    try {
      await closeInAppWebView();
    } catch (_) {}

    // 2. Traer la app al frente en Android
    if (defaultTargetPlatform == TargetPlatform.android) {
      try {
        const channel = MethodChannel('com.capricho.store/body_pose');
        await channel.invokeMethod('bringToFront');
      } catch (_) {}
    }

    // 3. Sincronizar y refrescar inmediatamente estado global de carrito, pedidos y notificaciones
    Future.microtask(() {
      ref.read(cartProvider.notifier).refresh();
      ref.read(ordersProvider.notifier).refresh();
      ref.read(notificationsProvider.notifier).refresh();
    });

    // 4. Si el pago fue cancelado explícitamente
    if (widget.status == 'CANCELADO') {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
      return;
    }

    // 5. Consultar estado si tenemos un sessionId
    final sid = widget.sessionId;
    if (sid != null && sid.isNotEmpty) {
      try {
        final api = ref.read(commerceApiProvider);
        final response = await api.getCheckoutStatus(sid);
        if (mounted) {
          setState(() {
            _statusResponse = response;
            _loading = false;
          });
          if (response.status == 'PAGADO') {
            HapticFeedback.mediumImpact();
            // Refrescar de nuevo para asegurar orden visible
            ref.read(cartProvider.notifier).refresh();
            ref.read(ordersProvider.notifier).refresh();
          }
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _loading = false;
            _errorMessage = e.toString().replaceAll('ApiException: ', '').trim();
          });
        }
      }
    } else {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        context.go('/pedidos');
      },
      child: Scaffold(
        backgroundColor: AppColors.canvas,
        appBar: AppBar(
          title: const Text('Estado del Pago'),
          automaticallyImplyLeading: false,
          actions: [
            IconButton(
              icon: const Icon(Icons.close_rounded),
              tooltip: 'Cerrar',
              onPressed: () => context.go('/pedidos'),
            ),
          ],
        ),
        body: SafeArea(
          child: _loading
              ? _buildLoadingView()
              : (widget.status == 'CANCELADO' ||
                      _statusResponse?.status == 'CANCELADO' ||
                      _statusResponse?.status == 'RECHAZADO')
                  ? _buildCancelledView()
                  : _buildSuccessView(),
        ),
      ),
    );
  }

  Widget _buildLoadingView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 52,
              height: 52,
              child: CircularProgressIndicator(
                strokeWidth: 3.5,
                color: AppColors.cobalt,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Confirmando tu pago...',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Estamos verificando la transacción con Stripe y preparando tu pedido.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.inkSoft,
                fontSize: 14,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCancelledView() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.shopping_bag_outlined,
                color: AppColors.warning,
                size: 58,
              ),
            ),
            const SizedBox(height: 22),
            Text(
              'Pago no completado',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink,
                  ),
            ),
            const SizedBox(height: 10),
            Text(
              _statusResponse?.message.isNotEmpty == true
                  ? _statusResponse!.message
                  : 'La transacción con Stripe fue cancelada. No se realizó ningún cargo a tu tarjeta y tus prendas siguen guardadas en el carrito.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.inkSoft,
                fontSize: 14,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => context.go('/carrito'),
                icon: const Icon(Icons.shopping_cart_outlined, size: 20),
                label: const Text(
                  'Volver a mi carrito',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.cobalt,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => context.go('/catalogo'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Explorar catálogo',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSuccessView() {
    final order = _statusResponse?.order;
    final receiptUrl = _statusResponse?.receiptUrl ?? order?.receiptUrl;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.check_circle_rounded,
              color: AppColors.success,
              size: 64,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            '¡Pago Confirmado con Éxito!',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Tu compra ha sido aprobada por Stripe y tu pedido ya está siendo preparado en tienda.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.inkSoft,
              fontSize: 14.5,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 24),

          if (order != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.line.withValues(alpha: 0.7)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Pedido #${order.idPedido}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 17,
                          color: AppColors.ink,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.success.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'PAGADO',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: AppColors.success,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 24),
                  _buildDetailRow(
                    icon: Icons.calendar_today_outlined,
                    label: 'Fecha',
                    value: DateFormat('dd/MM/yyyy HH:mm')
                        .format(order.fechaCreacion),
                  ),
                  const SizedBox(height: 10),
                  _buildDetailRow(
                    icon: order.modalidadEntrega == 'DELIVERY'
                        ? Icons.local_shipping_outlined
                        : Icons.storefront_outlined,
                    label: 'Modalidad',
                    value: order.modalidadEntrega == 'DELIVERY'
                        ? 'Envío a Domicilio'
                        : 'Retiro en Sucursal (${order.sucursal})',
                  ),
                  if (order.modalidadEntrega == 'DELIVERY' &&
                      order.direccionEntrega != null) ...[
                    const SizedBox(height: 10),
                    _buildDetailRow(
                      icon: Icons.location_on_outlined,
                      label: 'Destino',
                      value: order.direccionEntrega!,
                    ),
                  ],
                  const Divider(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Total pagado:',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: AppColors.inkSoft,
                        ),
                      ),
                      Text(
                        _currency.format(order.total),
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: AppColors.cobaltDark,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          if (receiptUrl != null && receiptUrl.isNotEmpty) ...[
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => launchUrl(
                  Uri.parse(receiptUrl),
                  mode: LaunchMode.inAppBrowserView,
                ),
                icon: const Icon(
                  Icons.receipt_long_rounded,
                  size: 18,
                  color: AppColors.cobalt,
                ),
                label: const Text(
                  'Ver recibo de Stripe',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.cobalt,
                  side: const BorderSide(color: AppColors.cobalt, width: 1.5),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],

          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () {
                if (order != null) {
                  context.go('/pedidos/${order.idPedido}');
                } else {
                  context.go('/pedidos');
                }
              },
              icon: const Icon(Icons.shopping_bag_outlined, size: 20),
              label: Text(
                order != null ? 'Ver detalle del pedido' : 'Ir a mis pedidos',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.cobalt,
                padding: const EdgeInsets.symmetric(vertical: 15),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => context.go('/inicio'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Volver a la tienda',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
              ),
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildDetailRow({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: AppColors.inkSoft),
        const SizedBox(width: 8),
        Text(
          '$label: ',
          style: const TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 13.5,
            color: AppColors.inkSoft,
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 13.5,
              color: AppColors.ink,
            ),
          ),
        ),
      ],
    );
  }
}
