namespace Tessera.Application.Common.Interfaces;

public record PaymentRequest(
    decimal Amount,
    string Currency,
    string PaymentMethodToken,
    string Description);

public record PaymentResult(
    bool Succeeded,
    string? ExternalPaymentId,
    string? FailureReason);

public interface IPaymentGateway
{
    Task<PaymentResult> ProcessPaymentAsync(PaymentRequest request, CancellationToken cancellationToken = default);
    Task<bool> RefundPaymentAsync(string externalPaymentId, CancellationToken cancellationToken = default);
}
