using MediatR;
using Microsoft.AspNetCore.Mvc;
using Tessera.Application.Tenants.Commands.CreateTenant;
using Tessera.Application.Tenants.Queries.GetTenantBySlug;

namespace Tessera.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TenantsController(IMediator mediator) : ControllerBase
{
    [HttpGet("{slug}")]
    public async Task<IActionResult> GetBySlug(string slug, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetTenantBySlugQuery(slug), cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTenantCommand command, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetBySlug), new { slug = result.Slug }, result);
    }
}
