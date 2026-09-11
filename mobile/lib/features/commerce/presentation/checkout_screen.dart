import 'dart:async';

import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/commerce/data/commerce_api.dart';
import 'package:capricho_store/features/commerce/domain/commerce_models.dart';
import 'package:capricho_store/features/commerce/presentation/commerce_controller.dart';
import 'package:capricho_store/shared/widgets/adaptive/adaptive_dialogs.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  String _deliveryMode = 'RETIRO_SUCURSAL'; // 'RETIRO_SUCURSAL' | 'DELIVERY'
  Address? _selectedAddress;
  ShippingQuote? _shippingQuote;
  bool _quoting = false;
  bool _processingCheckout = false;
  String? _error;

  final _currency = NumberFormat.currency(locale: 'es_BO', symbol: 'Bs ');

  @override
  void initState() {
    super.initState();
    // Cargar direcciones
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initDefaultAddress();
    });
  }

  Future<void> _initDefaultAddress() async {
    final addresses = await ref.read(addressesProvider.future);
    if (addresses.isNotEmpty && mounted) {
      final mainAddress = addresses.firstWhere(
        (a) => a.esPrincipal,
        orElse: () => addresses.first,
      );
      setState(() => _selectedAddress = mainAddress);
    }
  }

  Future<void> _onDeliveryModeChanged(String mode) async {
    HapticFeedback.selectionClick();
    setState(() {
      _deliveryMode = mode;
      _error = null;
    });

    if (mode == 'DELIVERY' && _selectedAddress != null) {
      await _requestQuote(_selectedAddress!);
    }
  }

  Future<void> _selectAddress(Address address) async {
    HapticFeedback.selectionClick();
    setState(() {
      _selectedAddress = address;
      _error = null;
    });
    await _requestQuote(address);
  }

  Future<void> _requestQuote(Address address) async {
    final cart = ref.read(cartProvider).value;
    if (cart == null || cart.idSucursal == null) return;

    setState(() {
      _quoting = true;
      _shippingQuote = null;
    });

    try {
      final api = ref.read(commerceApiProvider);
      final quote = await api.quoteShipping(
        branchId: cart.idSucursal!,
        addressId: address.idDireccion,
      );
      if (mounted) {
        setState(() {
          _shippingQuote = quote;
          _quoting = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _quoting = false;
          _error = 'Error cotizando envío: ${e.toString().replaceAll("ApiException: ", "")}';
        });
      }
    }
  }

  Future<void> _showNewAddressDialog() async {
    final cityController = TextEditingController(text: '1');
    final streetController = TextEditingController();
    final zoneController = TextEditingController();
    final refController = TextEditingController();

    final created = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Nueva dirección de entrega'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: streetController,
                decoration: const InputDecoration(
                  labelText: 'Calle y número *',
                  hintText: 'Ej. Av. Ballivián #450',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: zoneController,
                decoration: const InputDecoration(
                  labelText: 'Zona / Barrio *',
                  hintText: 'Ej. Calacoto',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: refController,
                decoration: const InputDecoration(
                  labelText: 'Referencia (opcional)',
                  hintText: 'Ej. Frente a la plaza, portón negro',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () async {
              if (streetController.text.trim().isEmpty ||
                  zoneController.text.trim().isEmpty) {
                return;
              }
              try {
                final newAddr = await ref.read(addressesProvider.notifier).addAddress(
                      cityId: int.tryParse(cityController.text) ?? 1,
                      zone: zoneController.text.trim(),
                      address: streetController.text.trim(),
                      reference: refController.text.trim(),
                      isMain: true,
                    );
                if (ctx.mounted) {
                  Navigator.of(ctx).pop(true);
                  setState(() => _selectedAddress = newAddr);
                  _requestQuote(newAddr);
                }
              } catch (_) {}
            },
            child: const Text('Guardar'),
          ),
        ],
      ),
    );
  }

  Future<void> _startStripeCheckout(Cart cart) async {
    if (_deliveryMode == 'DELIVERY') {
      if (_selectedAddress == null) {
        setState(() => _error = 'Por favor selecciona una dirección de entrega.');
        return;
      }
      if (_shippingQuote == null) {
        setState(() => _error = 'Falta cotizar el envío para esta dirección.');
        return;
      }
    }

    setState(() {
      _processingCheckout = true;
      _error = null;
    });

    HapticFeedback.mediumImpact();

    try {
      final api = ref.read(commerceApiProvider);
      final checkoutData = await api.checkout(
        branchId: cart.idSucursal!,
        deliveryMode: _deliveryMode,
        addressId: _deliveryMode == 'DELIVERY' ? _selectedAddress!.idDireccion : null,
        quoteId: _deliveryMode == 'DELIVERY' ? _shippingQuote!.idCotizacion : null,
      );

      final uri = Uri.parse(checkoutData.checkoutUrl);
      final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);

      if (!launched && mounted) {
        setState(() {
          _error = 'No se pudo abrir el navegador para completar el pago de Stripe.';
          _processingCheckout = false;
        });
        return;
      }

      // Al retornar del navegador, verificar el estado
      if (mounted) {
        _showPaymentVerificationSheet(checkoutData.sessionId);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('ApiException: ', '');
          _processingCheckout = false;
        });
      }
    }
  }

  void _showPaymentVerificationSheet(String sessionId) {
    showModalBottomSheet(
      context: context,
      isDismissible: false,
      enableDrag: false,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _PaymentPollerView(
        sessionId: sessionId,
        onSuccess: (order, receiptUrl) {
          Navigator.of(ctx).pop();
          // Refrescar carrito
          ref.read(cartProvider.notifier).refresh();
          ref.read(ordersProvider.notifier).refresh();
          _showSuccessScreen(order, receiptUrl);
        },
        onCancel: () {
          Navigator.of(ctx).pop();
          setState(() => _processingCheckout = false);
        },
      ),
    );
  }

  void _showSuccessScreen(Order order, String? receiptUrl) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle_rounded,
                color: AppColors.success,
                size: 54,
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              '¡Pedido Confirmado!',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Orden #${order.idPedido} registrada exitosamente.',
              style: const TextStyle(fontSize: 13, color: AppColors.inkSoft),
            ),
            const SizedBox(height: 14),
            Text(
              'Total pagado: ${_currency.format(order.total)}',
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 16,
                color: AppColors.cobaltDark,
              ),
            ),
            if (receiptUrl != null && receiptUrl.isNotEmpty) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => launchUrl(
                  Uri.parse(receiptUrl),
                  mode: LaunchMode.externalApplication,
                ),
                icon: const Icon(Icons.receipt_long_rounded, size: 18),
                label: const Text('Ver recibo de Stripe'),
              ),
            ],
          ],
        ),
        actions: [
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              context.go('/pedidos');
            },
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.cobalt,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text('Ir a mis pedidos'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider).value;

    if (cart == null || cart.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Confirmar pedido')),
        body: const Center(
          child: Text('No hay productos en el carrito para procesar.'),
        ),
      );
    }

    final shippingCost = _deliveryMode == 'DELIVERY'
        ? (_shippingQuote?.costoEstimado ?? 0.0)
        : 0.0;
    final grandTotal = cart.total + shippingCost;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Confirmar pedido'),
        shape: const Border(
          bottom: BorderSide(color: AppColors.line, width: 1),
        ),
      ),
      body: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 140),
            children: [
              // Selector de Modalidad de Entrega
              const Text(
                'Modalidad de Entrega',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _buildDeliveryTypeOption(
                      title: 'Retiro en Tienda',
                      subtitle: 'Sin costo adicional',
                      icon: Icons.store_mall_directory_rounded,
                      isSelected: _deliveryMode == 'RETIRO_SUCURSAL',
                      onTap: () => _onDeliveryModeChanged('RETIRO_SUCURSAL'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildDeliveryTypeOption(
                      title: 'Envío Delivery',
                      subtitle: 'A tu domicilio',
                      icon: Icons.two_wheeler_rounded,
                      isSelected: _deliveryMode == 'DELIVERY',
                      onTap: () => _onDeliveryModeChanged('DELIVERY'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Contenido según modalidad
              if (_deliveryMode == 'RETIRO_SUCURSAL')
                _buildPickupSection(cart)
              else
                _buildDeliverySection(),

              const SizedBox(height: 24),

              // Resumen financiero
              const Text(
                'Resumen de la orden',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.line),
                ),
                child: Column(
                  children: [
                    _buildSummaryRow(
                      'Subtotal prendas (${cart.totalQuantity})',
                      _currency.format(cart.total),
                    ),
                    const SizedBox(height: 8),
                    _buildSummaryRow(
                      'Costo de envío',
                      _deliveryMode == 'RETIRO_SUCURSAL'
                          ? 'Gratis (Bs 0.00)'
                          : (_shippingQuote != null
                              ? _currency.format(_shippingQuote!.costoEstimado)
                              : (_quoting ? 'Calculando...' : 'Pendiente')),
                      highlight: _deliveryMode == 'RETIRO_SUCURSAL',
                    ),
                    const Divider(height: 20),
                    _buildSummaryRow(
                      'Total a pagar',
                      _currency.format(grandTotal),
                      isTotal: true,
                    ),
                  ],
                ),
              ),

              if (_error != null) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.danger.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    _error!,
                    style: const TextStyle(
                      color: AppColors.danger,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ],
          ),

          // Barra inferior de Pago
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                border: const Border(top: BorderSide(color: AppColors.line, width: 1)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 10,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  child: FilledButton.icon(
                    onPressed: _processingCheckout ? null : () => _startStripeCheckout(cart),
                    icon: _processingCheckout
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.payment_rounded),
                    label: Text(
                      _processingCheckout
                          ? 'Conectando con Stripe…'
                          : 'Pagar ${_currency.format(grandTotal)} con Stripe',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.cobalt,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeliveryTypeOption({
    required String title,
    required String subtitle,
    required IconData icon,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.cobaltLight : AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.cobalt : AppColors.line,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              icon,
              color: isSelected ? AppColors.cobalt : AppColors.inkSoft,
              size: 26,
            ),
            const SizedBox(height: 8),
            Text(
              title,
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 14,
                color: isSelected ? AppColors.cobaltDark : AppColors.ink,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 11.5,
                color: isSelected ? AppColors.cobalt : AppColors.inkSoft,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPickupSection(Cart cart) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.check_circle_rounded,
                  color: AppColors.success, size: 20),
              const SizedBox(width: 8),
              Text(
                'Retiro en Sucursal ${cart.sucursal ?? ""}',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14.5,
                  color: AppColors.ink,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Tu pedido se preparará y estará disponible para entrega inmediata tras la confirmación del pago.',
            style: TextStyle(fontSize: 13, color: AppColors.inkSoft, height: 1.35),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.canvas,
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Text(
              'Costo de entrega: Bs 0.00 (Gratuito)',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 12,
                color: AppColors.success,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeliverySection() {
    final addressesAsync = ref.watch(addressesProvider);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Dirección de Envío',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14.5,
                  color: AppColors.ink,
                ),
              ),
              TextButton.icon(
                onPressed: _showNewAddressDialog,
                icon: const Icon(Icons.add_rounded, size: 16),
                label: const Text('Nueva'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          addressesAsync.when(
            loading: () => const LinearProgressIndicator(),
            error: (err, _) => Text('Error: $err'),
            data: (addresses) {
              if (addresses.isEmpty) {
                return OutlinedButton.icon(
                  onPressed: _showNewAddressDialog,
                  icon: const Icon(Icons.add_location_alt_outlined),
                  label: const Text('Registrar dirección para delivery'),
                );
              }
              return DropdownButtonFormField<Address>(
                value: _selectedAddress,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Selecciona dirección guardada',
                  border: OutlineInputBorder(),
                ),
                items: addresses
                    .map(
                      (addr) => DropdownMenuItem(
                        value: addr,
                        child: Text(
                          addr.displayName,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (addr) {
                  if (addr != null) _selectAddress(addr);
                },
              );
            },
          ),
          const SizedBox(height: 14),

          // Tarjeta de Cotización OpenRouteService
          if (_quoting)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  SizedBox(
                    height: 16,
                    width: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  SizedBox(width: 10),
                  Text('Cotizando ruta vial con OpenRouteService...'),
                ],
              ),
            )
          else if (_shippingQuote != null)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.canvas,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.line),
              ),
              child: Row(
                children: [
                  const Icon(Icons.route_rounded,
                      color: AppColors.cobalt, size: 22),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Distancia: ${_shippingQuote!.formattedDistance} (${_shippingQuote!.duracionEstimadaMin ?? 15} min aprox.)',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 12.5,
                            color: AppColors.ink,
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Cálculo vial en tiempo real vía OpenRouteService',
                          style: TextStyle(fontSize: 11, color: AppColors.inkSoft),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    _shippingQuote!.formattedCost,
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 15,
                      color: AppColors.cobaltDark,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(
    String label,
    String value, {
    bool isTotal = false,
    bool highlight = false,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: isTotal ? 16 : 13.5,
            fontWeight: isTotal ? FontWeight.w800 : FontWeight.w500,
            color: isTotal ? AppColors.ink : AppColors.inkSoft,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: isTotal ? 18 : 13.5,
            fontWeight: isTotal ? FontWeight.w900 : FontWeight.w700,
            color: isTotal
                ? AppColors.cobaltDark
                : (highlight ? AppColors.success : AppColors.ink),
          ),
        ),
      ],
    );
  }
}

class _PaymentPollerView extends StatefulWidget {
  final String sessionId;
  final void Function(Order order, String? receiptUrl) onSuccess;
  final VoidCallback onCancel;

  const _PaymentPollerView({
    required this.sessionId,
    required this.onSuccess,
    required this.onCancel,
  });

  @override
  State<_PaymentPollerView> createState() => _PaymentPollerViewState();
}

class _PaymentPollerViewState extends State<_PaymentPollerView> {
  Timer? _timer;
  String _statusMessage = 'Esperando confirmación de pago en Stripe...';

  @override
  void initState() {
    super.initState();
    _startPolling();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startPolling() {
    _timer = Timer.periodic(const Duration(seconds: 3), (t) async {
      final container = ProviderScope.containerOf(context, listen: false);
      final api = container.read(commerceApiProvider);

      try {
        final status = await api.getCheckoutStatus(widget.sessionId);
        if (!mounted) return;

        if (status.status == 'PAGADO' && status.order != null) {
          t.cancel();
          widget.onSuccess(status.order!, status.receiptUrl);
        } else if (status.status == 'CANCELADO' || status.status == 'RECHAZADO') {
          t.cancel();
          widget.onCancel();
        } else {
          setState(() {
            _statusMessage = status.message.isNotEmpty
                ? status.message
                : 'Procesando pago con Stripe...';
          });
        }
      } catch (_) {}
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: AppColors.cobalt),
            const SizedBox(height: 18),
            const Text(
              'Verificando tu pago con Stripe',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _statusMessage,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: AppColors.inkSoft),
            ),
            const SizedBox(height: 20),
            OutlinedButton(
              onPressed: widget.onCancel,
              child: const Text('Volver al checkout'),
            ),
          ],
        ),
      ),
    );
  }
}
