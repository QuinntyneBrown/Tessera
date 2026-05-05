using MediatR;
using Microsoft.AspNetCore.Mvc;
using Tessera.Application.Payments.Commands.ProcessPayment;

namespace Tessera.Api.Controllers;

[ApiController]
[Route("api/tenants/{tenantId:guid}/[controller]")]
public class PaymentsController(IMediator mediator) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Process(Guid tenantId, [FromBody] ProcessPaymentRequest request, CancellationToken cancellationToken)
    {
        var command = new ProcessPaymentCommand(tenantId, request.BookingId, request.Amount, request.Currency, request.PaymentMethodToken, request.PaymentMethod);
        var result = await mediator.Send(command, cancellationToken);
        return Ok(result);
    }
}

public record ProcessPaymentRequest(Guid BookingId, decimal Amount, string Currency, string PaymentMethodToken, string PaymentMethod);
