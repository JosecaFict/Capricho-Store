from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest

from app.modules.auth.models import Cliente, Empleado, Sucursal, Usuario
from app.modules.commerce.exceptions import CommerceForbiddenError
from app.modules.commerce.invoice_service import (
    InvoiceData,
    InvoiceItem,
    amount_to_words_es,
    generate_invoice_pdf,
)
from app.modules.commerce.models import Pedido, Venta
from app.modules.commerce.service import CommerceService


def test_amount_to_words_es():
    assert amount_to_words_es(Decimal("0.00")) == "Cero 00/100 Bolivianos"
    assert amount_to_words_es(Decimal("5.00")) == "Cinco 00/100 Bolivianos"
    assert amount_to_words_es(Decimal("21.50")) == "Veintiun 50/100 Bolivianos"
    assert amount_to_words_es(Decimal("100.00")) == "Cien 00/100 Bolivianos"
    assert amount_to_words_es(Decimal("905.00")) == "Novecientos cinco 00/100 Bolivianos"
    assert amount_to_words_es(Decimal("1250.75")) == "Mil doscientos cincuenta 75/100 Bolivianos"


def test_generate_invoice_pdf_produces_valid_pdf():
    data = InvoiceData(
        numero_factura="FAC-000042",
        fecha_emision=datetime.now(),
        estado_pago="PAGADA",
        cliente_nombre="Ana García",
        cliente_doc="1234567 SC",
        cliente_correo="ana@test.com",
        cliente_telefono="+591 70011223",
        modalidad_entrega="DELIVERY",
        destino_entrega="Av. Banzer 4to Anillo #100",
        subtotal=Decimal("450.00"),
        descuento=Decimal("0.00"),
        costo_envio=Decimal("12.50"),
        total=Decimal("462.50"),
        metodo_pago="Tarjeta de Crédito / Débito (Stripe)",
        items=[
            InvoiceItem(
                marca="Zara",
                producto="Blusa Lino",
                color="Blanco",
                talla="M",
                cantidad=1,
                precio_unitario=Decimal("200.00"),
                subtotal=Decimal("200.00"),
            ),
            InvoiceItem(
                marca="Levi's",
                producto="Falda Denim",
                color="Azul",
                talla="S",
                cantidad=1,
                precio_unitario=Decimal("250.00"),
                subtotal=Decimal("250.00"),
            ),
        ],
    )
    pdf_bytes = generate_invoice_pdf(data)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF-")


@pytest.mark.asyncio
async def test_get_order_invoice_pdf_authorizes_customer_and_fails_for_stranger():
    session = AsyncMock()
    repository = AsyncMock()
    mailer = AsyncMock()
    service = CommerceService(session, repository, invoice_mailer=mailer)

    order = Pedido(id_pedido=10, id_venta=20, estado="ENTREGADO", fecha_creacion=datetime.now())
    sale = Venta(
        id_venta=20,
        id_cliente=5,
        id_sucursal=1,
        canal_venta="ONLINE",
        modalidad_entrega="DELIVERY",
        estado="PAGADA",
        subtotal=Decimal("100.00"),
        descuento_total=Decimal("0.00"),
        costo_envio=Decimal("10.00"),
        total=Decimal("110.00"),
        fecha_venta=datetime.now(),
    )
    branch = Sucursal(id_sucursal=1, nombre="Central", direccion="Calle 1", telefono="70000000")
    customer = Cliente(id_cliente=5, id_usuario=100)
    user = Usuario(
        id_usuario=100, nombres="Juan", apellidos="Perez", correo="juan@test.com", ci="12345"
    )

    async def mock_get(entity, ident):
        if entity is Pedido and ident == 10:
            return order
        if entity is Venta and ident == 20:
            return sale
        if entity is Sucursal and ident == 1:
            return branch
        if entity is Cliente and ident == 5:
            return customer
        if entity is Usuario and ident == 100:
            return user
        return None

    repository.get.side_effect = mock_get
    repository.customer_by_user.return_value = customer
    repository.payment_by_sale.return_value = None
    repository.sale_invoice_items.return_value = [
        {
            "marca": "Zara",
            "producto": "Polo",
            "color": "Negro",
            "talla": "L",
            "cantidad": 1,
            "precio_unitario": Decimal("100.00"),
            "subtotal": Decimal("100.00"),
        }
    ]

    # Owner customer requesting invoice
    pdf = await service.get_order_invoice_pdf(user_id=100, order_id=10)
    assert pdf.startswith(b"%PDF-")

    # Stranger requesting invoice (not owner, not employee)
    repository.customer_by_user.return_value = Cliente(id_cliente=99, id_usuario=999)
    repository.employee_by_user.return_value = None
    with pytest.raises(CommerceForbiddenError):
        await service.get_order_invoice_pdf(user_id=999, order_id=10)


@pytest.mark.asyncio
async def test_update_order_status_to_retirado_triggers_invoice_email():
    session = AsyncMock()
    repository = AsyncMock()
    mailer = AsyncMock()
    mailer.send_invoice_email = AsyncMock(return_value=True)
    service = CommerceService(session, repository, invoice_mailer=mailer)

    order = Pedido(
        id_pedido=77, id_venta=88, estado="LISTO_PARA_RETIRO", fecha_creacion=datetime.now()
    )
    sale = Venta(
        id_venta=88,
        id_cliente=3,
        id_sucursal=1,
        canal_venta="ONLINE",
        modalidad_entrega="RETIRO_SUCURSAL",
        estado="PAGADA",
        subtotal=Decimal("200.00"),
        descuento_total=Decimal("0.00"),
        costo_envio=Decimal("0.00"),
        total=Decimal("200.00"),
        fecha_venta=datetime.now(),
    )
    branch = Sucursal(id_sucursal=1, nombre="Norte", direccion="Av. Norte 12", telefono="70000000")
    customer = Cliente(id_cliente=3, id_usuario=42)
    user = Usuario(
        id_usuario=42, nombres="María", apellidos="Gómez", correo="maria@test.com", ci="78910"
    )
    employee = Empleado(id_empleado=1, id_usuario=1, id_sucursal=1, estado_laboral="ACTIVO")

    async def mock_get(entity, ident):
        if entity is Pedido and ident == 77:
            return order
        if entity is Venta and ident == 88:
            return sale
        if entity is Sucursal and ident == 1:
            return branch
        if entity is Cliente and ident == 3:
            return customer
        if entity is Usuario and ident == 42:
            return user
        return None

    repository.get.side_effect = mock_get
    repository.employee_by_user.return_value = employee
    repository.customer_by_user.return_value = customer
    repository.payment_by_sale.return_value = None
    repository.sale_details.return_value = []
    repository.sale_invoice_items.return_value = [
        {
            "marca": "Tommy",
            "producto": "Vestido",
            "color": "Rojo",
            "talla": "S",
            "cantidad": 1,
            "precio_unitario": Decimal("200.00"),
            "subtotal": Decimal("200.00"),
        }
    ]

    from app.modules.commerce.schemas import OrderStatusUpdate

    res = await service.update_order_status(
        user_id=1, order_id=77, payload=OrderStatusUpdate(estado="RETIRADO")
    )
    assert res.estado == "RETIRADO"
    assert mailer.send_invoice_email.called
    call_kwargs = mailer.send_invoice_email.call_args.kwargs
    assert call_kwargs["recipient_email"] == "maria@test.com"
    assert call_kwargs["order_id"] == 77
    assert call_kwargs["pdf_bytes"].startswith(b"%PDF-")

