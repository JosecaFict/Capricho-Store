import 'dart:async';
import 'dart:math' as math;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/shared/services/geocoding_service.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Un mapa visual interactivo basado en teselas de OpenStreetMap (sin SDKs nativos ni API keys)
/// que permite visualizar la ubicación exacta con un marcador central y desplazar el mapa con el dedo.
class LocationMapPreview extends StatefulWidget {
  final double latitude;
  final double longitude;
  final String? zone;
  final ValueChanged<({double lat, double lng})>? onLocationChanged;
  final ValueChanged<GeocodedAddress>? onAddressDetected;
  final double height;

  const LocationMapPreview({
    super.key,
    required this.latitude,
    required this.longitude,
    this.zone,
    this.onLocationChanged,
    this.onAddressDetected,
    this.height = 180,
  });

  @override
  State<LocationMapPreview> createState() => _LocationMapPreviewState();
}

class _LocationMapPreviewState extends State<LocationMapPreview> {
  int _zoom = 15;
  late double _currentLat;
  late double _currentLng;
  double _panOffsetX = 0;
  double _panOffsetY = 0;
  bool _isDragging = false;
  Timer? _debounceTimer;
  String? _detectedRoad;
  bool _isGeocoding = false;

  @override
  void initState() {
    super.initState();
    _currentLat = widget.latitude;
    _currentLng = widget.longitude;
    _triggerGeocoding();
  }

  @override
  void didUpdateWidget(covariant LocationMapPreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    if ((oldWidget.latitude != widget.latitude ||
            oldWidget.longitude != widget.longitude) &&
        !_isDragging) {
      _currentLat = widget.latitude;
      _currentLng = widget.longitude;
      _panOffsetX = 0;
      _panOffsetY = 0;
      _triggerGeocoding();
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    super.dispose();
  }

  void _triggerGeocoding() {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 500), () async {
      if (!mounted) return;
      setState(() => _isGeocoding = true);
      final result = await GeocodingService.reverseGeocode(_currentLat, _currentLng);
      if (!mounted) return;
      setState(() {
        _isGeocoding = false;
        if (result != null) {
          _detectedRoad = result.road ?? result.zone;
        }
      });
      if (result != null) {
        widget.onAddressDetected?.call(result);
      }
    });
  }

  // Conversiones estándar de teselas OSM
  static double _lonToTileX(double lon, int z) =>
      (lon + 180.0) / 360.0 * (1 << z);

  static double _latToTileY(double lat, int z) {
    final latRad = lat * math.pi / 180.0;
    return (1.0 -
            math.log(math.tan(latRad) + 1.0 / math.cos(latRad)) / math.pi) /
        2.0 *
        (1 << z);
  }

  static double _tileXToLon(double x, int z) => x / (1 << z) * 360.0 - 180.0;

  static double _tileYToLat(double y, int z) {
    final n = math.pi - 2.0 * math.pi * y / (1 << z);
    return 180.0 / math.pi * math.atan(0.5 * (math.exp(n) - math.exp(-n)));
  }

  void _onPanStart(DragStartDetails details) {
    setState(() => _isDragging = true);
  }

  void _onPanUpdate(DragUpdateDetails details) {
    setState(() {
      _panOffsetX += details.delta.dx;
      _panOffsetY += details.delta.dy;
    });
  }

  void _onPanEnd(DragEndDetails details) {
    setState(() => _isDragging = false);
    // Cada tesela tiene 256 px
    final tileCenterX = _lonToTileX(_currentLng, _zoom) - (_panOffsetX / 256.0);
    final tileCenterY = _latToTileY(_currentLat, _zoom) - (_panOffsetY / 256.0);

    final newLng = _tileXToLon(tileCenterX, _zoom);
    final newLat = _tileYToLat(tileCenterY, _zoom);

    setState(() {
      _currentLat = double.parse(newLat.toStringAsFixed(5));
      _currentLng = double.parse(newLng.toStringAsFixed(5));
      _panOffsetX = 0;
      _panOffsetY = 0;
    });

    widget.onLocationChanged?.call((lat: _currentLat, lng: _currentLng));
    _triggerGeocoding();
  }

  Future<void> _openExternalMap() async {
    final url = Uri.parse(
        'https://www.google.com/maps/search/?api=1&query=$_currentLat,$_currentLng');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    const tileSize = 256.0;
    final exactTileX = _lonToTileX(_currentLng, _zoom) - (_panOffsetX / tileSize);
    final exactTileY = _latToTileY(_currentLat, _zoom) - (_panOffsetY / tileSize);

    final centerTileX = exactTileX.floor();
    final centerTileY = exactTileY.floor();

    final fracX = exactTileX - centerTileX;
    final fracY = exactTileY - centerTileY;

    final screenWidth = MediaQuery.of(context).size.width;
    final halfW = (screenWidth * 0.45).clamp(140.0, 260.0);
    final halfH = widget.height / 2.0;

    final List<Widget> tileWidgets = [];

    // Rejilla de teselas alrededor del centro (-2 a 2 horizontal, -1 a 1 vertical)
    for (int dx = -2; dx <= 2; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        final tileX = centerTileX + dx;
        final tileY = centerTileY + dy;

        // Posición del tile respecto al centro del widget
        final left = halfW + (dx - fracX) * tileSize;
        final top = halfH + (dy - fracY) * tileSize;

        final tileUrl =
            'https://tile.openstreetmap.org/$_zoom/$tileX/$tileY.png';

        tileWidgets.add(
          Positioned(
            left: left,
            top: top,
            width: tileSize,
            height: tileSize,
            child: CachedNetworkImage(
              imageUrl: tileUrl,
              fit: BoxFit.cover,
              httpHeaders: const {
                'User-Agent': 'CaprichoStoreApp/1.0 (contact@caprichostore.bo)',
              },
              placeholder: (_, _) => Container(
                color: const Color(0xFFF1F5F9),
                child: const Center(
                  child: SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 1.5),
                  ),
                ),
              ),
              errorWidget: (_, __, ___) => Container(
                color: const Color(0xFFF1F5F9),
                child: const Center(
                  child: Icon(Icons.map_outlined, color: AppColors.inkSoft, size: 28),
                ),
              ),
            ),
          ),
        );
      }
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Container(
        height: widget.height,
        width: double.infinity,
        decoration: BoxDecoration(
          color: const Color(0xFFE5E7EB),
          border: Border.all(color: AppColors.line, width: 1.2),
        ),
        child: Stack(
          children: [
            // Rejilla de teselas OSM con soporte para arrastre
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onPanStart: _onPanStart,
              onPanUpdate: _onPanUpdate,
              onPanEnd: _onPanEnd,
              child: Stack(children: tileWidgets),
            ),

            // Pin centrado con animación sutil al arrastrar
            Center(
              child: Transform.translate(
                offset: const Offset(0, -18), // El punto exacto es la punta inferior
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.cobalt,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.25),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.location_pin,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: AppColors.cobaltDark,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Controles de zoom y abrir en mapa
            Positioned(
              top: 8,
              right: 8,
              child: Column(
                children: [
                  _circleButton(
                    icon: Icons.add_rounded,
                    onTap: () {
                      if (_zoom < 18) setState(() => _zoom++);
                    },
                  ),
                  const SizedBox(height: 6),
                  _circleButton(
                    icon: Icons.remove_rounded,
                    onTap: () {
                      if (_zoom > 12) setState(() => _zoom--);
                    },
                  ),
                  const SizedBox(height: 6),
                  _circleButton(
                    icon: Icons.open_in_new_rounded,
                    tooltip: 'Abrir en Mapas',
                    onTap: _openExternalMap,
                  ),
                ],
              ),
            ),

            // Badge inferior con zona y coordenadas
            Positioned(
              bottom: 8,
              left: 8,
              right: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.94),
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Icon(
                      _detectedRoad != null ? Icons.location_on_rounded : Icons.explore_rounded,
                      color: AppColors.cobalt,
                      size: 16,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _isGeocoding
                            ? 'Detectando calle...'
                            : (_detectedRoad != null
                                ? '$_detectedRoad'
                                : '${widget.zone ?? "Ubicación"}: ${_currentLat.toStringAsFixed(4)}, ${_currentLng.toStringAsFixed(4)}'),
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (_isGeocoding)
                      const SizedBox(
                        width: 12,
                        height: 12,
                        child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.cobalt),
                      )
                    else
                      const Text(
                        'Arrastra para mover',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w500,
                          color: AppColors.inkSoft,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _circleButton({
    required IconData icon,
    required VoidCallback onTap,
    String? tooltip,
  }) {
    return Material(
      color: Colors.white.withValues(alpha: 0.92),
      shape: const CircleBorder(),
      elevation: 2,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Icon(icon, size: 16, color: AppColors.ink),
        ),
      ),
    );
  }
}
