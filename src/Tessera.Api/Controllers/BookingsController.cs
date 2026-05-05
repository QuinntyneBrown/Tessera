using MediatR;
using Microsoft.AspNetCore.Mvc;
using Tessera.Application.Bookings.Commands.CreateBooking;

namespace Tessera.Api.Controllers;

[ApiController]
[Route("api/tenants/{tenantId:guid}/[controller]")]
public class BookingsController(IMediator mediator) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(Guid tenantId, [FromBody] CreateBookingRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateBookingCommand(tenantId, request.ClassSessionId, request.ParticipantId);
        var result = await mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(Create), new { tenantId, id = result.Id }, result);
    }
}

public record CreateBookingRequest(Guid ClassSessionId, Guid ParticipantId);
