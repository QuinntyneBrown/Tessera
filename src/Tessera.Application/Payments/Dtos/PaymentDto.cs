namespace Tessera.Application.Payments.Dtos;

public record PaymentDto(
    Guid Id,
    Guid TenantId,
    Guid BookingId,
    decimal Amount,
    string Currency,
    string Status,
    string Method,
    string? ExternalPaymentId,
    DateTime CreatedAt);
