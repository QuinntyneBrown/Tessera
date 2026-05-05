using Microsoft.AspNetCore.Http;
using Tessera.Application.Common.Interfaces;

namespace Tessera.Infrastructure.Services;

public class CurrentTenantService(IHttpContextAccessor httpContextAccessor) : ICurrentTenantService
{
    public Guid? TenantId
    {
        get
        {
            var value = httpContextAccessor.HttpContext?.Items["TenantId"];
            return value is Guid guid ? guid : null;
        }
    }

    public string? TenantSlug
        => httpContextAccessor.HttpContext?.Items["TenantSlug"] as string;
}
