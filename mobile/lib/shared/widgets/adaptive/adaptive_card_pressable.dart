import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Widget interactivo adaptativo para tarjetas y elementos presionables.
/// - En iOS: Genera una micro-compresión elástica con resorte (97%) y clic de Taptic Engine.
/// - En Android: Genera una onda de agua luminosa (Material Ink Ripple).
class AdaptiveCardPressable extends StatefulWidget {
  const AdaptiveCardPressable({
    required this.child,
    super.key,
    this.onTap,
    this.onLongPress,
    this.borderRadius,
    this.color,
    this.border,
    this.padding,
    this.elevation = 0,
    this.enableHaptic = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final BorderRadius? borderRadius;
  final Color? color;
  final BoxBorder? border;
  final EdgeInsetsGeometry? padding;
  final double elevation;
  final bool enableHaptic;

  @override
  State<AdaptiveCardPressable> createState() => _AdaptiveCardPressableState();
}

class _AdaptiveCardPressableState extends State<AdaptiveCardPressable>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
      reverseDuration: const Duration(milliseconds: 140),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.97).animate(
      CurvedAnimation(
        parent: _controller,
        curve: Curves.easeInOut,
        reverseCurve: Curves.easeOutBack,
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleTapDown(TapDownDetails _) {
    if (widget.onTap != null) {
      _controller.forward();
      if (widget.enableHaptic && defaultTargetPlatform == TargetPlatform.iOS) {
        HapticFeedback.selectionClick();
      }
    }
  }

  void _handleTapUp(TapUpDetails _) {
    if (widget.onTap != null) {
      _controller.reverse();
    }
  }

  void _handleTapCancel() {
    if (widget.onTap != null) {
      _controller.reverse();
    }
  }

  @override
  Widget build(BuildContext context) {
    final effectiveRadius = widget.borderRadius ?? BorderRadius.circular(16);
    final isIOS = defaultTargetPlatform == TargetPlatform.iOS;

    if (isIOS) {
      return GestureDetector(
        onTapDown: _handleTapDown,
        onTapUp: _handleTapUp,
        onTapCancel: _handleTapCancel,
        onTap: widget.onTap,
        onLongPress: () {
          if (widget.enableHaptic) {
            HapticFeedback.mediumImpact();
          }
          widget.onLongPress?.call();
        },
        behavior: HitTestBehavior.opaque,
        child: AnimatedBuilder(
          animation: _scaleAnimation,
          builder: (context, child) => Transform.scale(
            scale: _scaleAnimation.value,
            child: child,
          ),
          child: Container(
            padding: widget.padding,
            decoration: BoxDecoration(
              color: widget.color ?? Theme.of(context).colorScheme.surface,
              borderRadius: effectiveRadius,
              border: widget.border,
              boxShadow: widget.elevation > 0
                  ? [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.04 * widget.elevation),
                        blurRadius: 8 * widget.elevation,
                        offset: Offset(0, 2 * widget.elevation),
                      ),
                    ]
                  : null,
            ),
            child: widget.child,
          ),
        ),
      );
    }

    // Android: Material 3 con InkWell
    return Material(
      color: widget.color ?? Theme.of(context).colorScheme.surface,
      elevation: widget.elevation,
      borderRadius: effectiveRadius,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {
          if (widget.enableHaptic) {
            HapticFeedback.lightImpact();
          }
          widget.onTap?.call();
        },
        onLongPress: widget.onLongPress,
        borderRadius: effectiveRadius,
        child: Container(
          padding: widget.padding,
          decoration: BoxDecoration(
            borderRadius: effectiveRadius,
            border: widget.border,
          ),
          child: widget.child,
        ),
      ),
    );
  }
}
