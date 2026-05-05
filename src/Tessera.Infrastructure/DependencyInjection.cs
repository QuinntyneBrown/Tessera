using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Tessera.Application.Common.Interfaces;
using Tessera.Domain.Repositories;
using Tessera.Infrastructure.Persistence;
using Tessera.Infrastructure.Persistence.Repositories;
using Tessera.Infrastructure.Services;

namespace Tessera.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<TesseraDbContext>(options =>
            options.UseSqlServer(
                configuration.GetConnectionString("DefaultConnection"),
                b => b.MigrationsAssembly(typeof(TesseraDbContext).Assembly.FullName)));

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<ITenantRepository, TenantRepository>();
        services.AddScoped<IStudioRepository, StudioRepository>();
        services.AddScoped<IInstructorRepository, InstructorRepository>();
        services.AddScoped<IParticipantRepository, ParticipantRepository>();
        services.AddScoped<IYogaClassRepository, YogaClassRepository>();
        services.AddScoped<IClassSessionRepository, ClassSessionRepository>();
        services.AddScoped<IBookingRepository, BookingRepository>();
        services.AddScoped<IPaymentRepository, PaymentRepository>();
        services.AddScoped<IPaymentGateway, MockPaymentGateway>();
        services.AddScoped<ICurrentTenantService, CurrentTenantService>();
        services.AddHttpContextAccessor();

        return services;
    }
}
