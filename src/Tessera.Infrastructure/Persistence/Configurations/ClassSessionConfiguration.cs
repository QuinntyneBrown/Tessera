using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tessera.Domain.Entities;

namespace Tessera.Infrastructure.Persistence.Configurations;

public class ClassSessionConfiguration : IEntityTypeConfiguration<ClassSession>
{
    public void Configure(EntityTypeBuilder<ClassSession> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Status).HasConversion<string>();
        builder.HasMany(s => s.Bookings).WithOne(b => b.ClassSession).HasForeignKey(b => b.ClassSessionId).OnDelete(DeleteBehavior.Cascade);
        builder.Ignore(s => s.BookedCount);
    }
}
