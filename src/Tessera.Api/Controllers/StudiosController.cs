using MediatR;
using Microsoft.AspNetCore.Mvc;
using Tessera.Application.Studios.Commands.CreateStudio;
using Tessera.Application.Studios.Queries.GetStudiosByTenant;

namespace Tessera.Api.Controllers;

[ApiController]
[Route("api/tenants/{tenantId:guid}/[controller]")]
public class StudiosController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(Guid tenantId, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetStudiosByTenantQuery(tenantId), cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid tenantId, [FromBody] CreateStudioRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateStudioCommand(tenantId, request.Name, request.Description, request.Address, request.City, request.PhoneNumber, request.Email);
        var result = await mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetAll), new { tenantId }, result);
    }
}

public record CreateStudioRequest(string Name, string? Description, string Address, string City, string? PhoneNumber, string? Email);
