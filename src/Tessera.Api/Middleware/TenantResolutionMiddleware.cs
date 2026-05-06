using Tessera.Domain.Repositories;

namespace Tessera.Api.Middleware;

public class TenantResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ITenantRepository tenantRepository)
    {
        var host = context.Request.Host.Host;
        var tenantSlug = ExtractTenantSlug(host, context.Request.Headers);

        if (!string.IsNullOrEmpty(tenantSlug))
        {
            var tenant = await tenantRepository.GetBySlugAsync(tenantSlug);
            if (tenant != null)
            {
                context.Items["TenantId"] = tenant.Id;
                context.Items["TenantSlug"] = tenant.Slug;
            }
        }

        await next(context);
    }

    private static string? ExtractTenantSlug(string host, IHeaderDictionary headers)
    {
        if (headers.TryGetValue("X-Tenant-Slug", out var headerSlug))
            return headerSlug.ToString();

        var parts = host.Split('.');
        if (parts.Length >= 3)
            return parts[0];

        return null;
    }
}
