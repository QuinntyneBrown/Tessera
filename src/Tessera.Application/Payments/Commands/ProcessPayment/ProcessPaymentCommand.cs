using MediatR;
using Tessera.Application.Payments.Dtos;

namespace Tessera.Application.Payments.Commands.ProcessPayment;

public record ProcessPaymentCommand(
    Guid TenantId,
    Guid BookingId,
    decimal Amount,
    string Currency,
    string PaymentMethodToken,
    string PaymentMethod) : IRequest<PaymentDto>;
