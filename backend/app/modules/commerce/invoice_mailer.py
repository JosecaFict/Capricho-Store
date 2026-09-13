import base64
import logging
from html import escape

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class InvoiceMailer:
    endpoint = "https://api.brevo.com/v3/smtp/email"

    def __init__(
        self,
        *,
        api_key: str | None = None,
        sender_email: str | None = None,
        sender_name: str | None = None,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.brevo_api_key
        self.sender_email = sender_email or settings.brevo_sender_email
        self.sender_name = sender_name or settings.brevo_sender_name or "Capricho Store"

    async def send_invoice_email(
        self,
        *,
        recipient_email: str,
        recipient_name: str,
        order_id: int,
        total_bob: str,
        delivery_mode: str,
        pdf_bytes: bytes,
    ) -> bool:
        if not self.api_key or not self.sender_email:
            logger.info(
                "Brevo API key o sender email no configurados; se omite correo factura #%s.",
                order_id,
            )
            return False

        safe_name = escape(recipient_name or "Cliente")
        delivery_str = (
            "Envío a domicilio (Delivery)" if delivery_mode == "DELIVERY" else "Retiro en sucursal"
        )
        pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")

        html_content = (
            "<!doctype html><html lang='es'>"
            "<body style='margin:0;padding:0;background:#f8fafc;"
            "font-family:sans-serif;color:#1e293b;'>"
            "<div style='max-width:580px;margin:24px auto;background:#fff;"
            "border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;'>"
            "<div style='background:#064fe8;padding:24px;text-align:center;color:#fff;'>"
            "<h1 style='margin:0;font-size:22px;'>CAPRICHO STORE</h1>"
            "<p style='margin:6px 0 0;color:#dbeafe;font-size:13px;'>"
            "Comprobante Oficial de Compra</p></div>"
            "<div style='padding:24px;'>"
            f"<p style='font-size:15px;margin:0 0 14px;'>Hola <b>{safe_name}</b>,</p>"
            "<p style='font-size:14px;color:#475467;line-height:1.5;margin:0 0 18px;'>"
            "¡Tu compra ha sido procesada con éxito! Te adjuntamos tu "
            "<b>Factura Oficial en PDF</b> con el detalle de prendas adquiridas, "
            "precios y garantías.</p>"
            "<div style='background:#f8fafc;border:1px solid #e2e8f0;"
            "border-radius:8px;padding:14px;'>"
            "<table style='width:100%;font-size:13px;border-collapse:collapse;'>"
            f"<tr><td style='color:#64748b;'>N° Pedido:</td>"
            f"<td style='text-align:right;'><b>#{order_id}</b></td></tr>"
            f"<tr><td style='color:#64748b;'>Modalidad:</td>"
            f"<td style='text-align:right;'><b>{delivery_str}</b></td></tr>"
            f"<tr><td style='color:#64748b;'>Total:</td>"
            f"<td style='text-align:right;color:#064fe8;font-weight:800;font-size:15px;'>"
            f"Bs. {total_bob}</td></tr></table></div>"
            "<p style='font-size:12px;color:#64748b;margin:18px 0 0;line-height:1.4;'>"
            "* Cuentas con 7 días de garantía para cambios presentando tu factura adjunta."
            "</p></div>"
            "<div style='background:#f1f5f9;padding:14px;text-align:center;"
            "font-size:12px;color:#64748b;'>"
            "Capricho Store · Santa Cruz, Bolivia</div></div></body></html>"
        )

        payload = {
            "sender": {"email": self.sender_email, "name": self.sender_name},
            "to": [{"email": recipient_email, "name": recipient_name}],
            "subject": f"Factura de Compra #{order_id} | Capricho Store",
            "htmlContent": html_content,
            "textContent": (
                f"Hola {recipient_name}, tu compra para el pedido #{order_id} por Bs. {total_bob} "
                f"ha sido confirmada ({delivery_str}). Adjuntamos tu factura en PDF."
            ),
            "attachment": [
                {
                    "content": pdf_b64,
                    "name": f"Factura_Capricho_Pedido_{order_id}.pdf",
                }
            ],
            "tags": ["invoice", "order-confirmation"],
        }

        headers = {
            "accept": "application/json",
            "api-key": self.api_key,
            "content-type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                response = await client.post(self.endpoint, headers=headers, json=payload)
                response.raise_for_status()
            logger.info("Factura para pedido #%s enviada por correo via Brevo", order_id)
            return True
        except Exception as exc:
            logger.warning("No se pudo enviar correo factura #%s via Brevo: %s", order_id, exc)
            return False
