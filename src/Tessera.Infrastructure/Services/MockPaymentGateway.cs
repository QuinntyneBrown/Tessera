using Tessera.Application.Common.Interfaces;

namespace Tessera.Infrastructure.Services;

public class MockPaymentGateway : IPaymentGateway
{
    public Task<PaymentResult> ProcessPaymentAsync(PaymentRequest request, CancellationToken cancellationToken = default)
    {
        var result = new PaymentResult(
            Succeeded: true,
            ExternalPaymentId: $"mock_{Guid.NewGuid():N}",
            FailureReason: null);
        return Task.FromResult(result);
    }

    public Task<bool> RefundPaymentAsync(string externalPaymentId, CancellationToken cancellationToken = default)
        => Task.FromResult(true);
}
