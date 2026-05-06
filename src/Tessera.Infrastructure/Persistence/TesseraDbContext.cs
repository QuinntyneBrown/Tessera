using Microsoft.EntityFrameworkCore;
using Tessera.Domain.Entities;

namespace Tessera.Infrastructure.Persistence;

public class TesseraDbContext(DbContextOptions<TesseraDbContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Studio> Studios => Set<Studio>();
    public DbSet<Instructor> Instructors => Set<Instructor>();
    public DbSet<Participant> Participants => Set<Participant>();
    public DbSet<YogaClass> YogaClasses => Set<YogaClass>();
    public DbSet<ClassSession> ClassSessions => Set<ClassSession>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Payment> Payments => Set<Payment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(TesseraDbContext).Assembly);
    }
}
