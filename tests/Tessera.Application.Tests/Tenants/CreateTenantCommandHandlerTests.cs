using MediatR;
using Moq;
using Tessera.Application.Tenants.Commands.CreateTenant;
using Tessera.Domain.Entities;
using Tessera.Domain.Repositories;
using Xunit;

namespace Tessera.Application.Tests.Tenants;

public class CreateTenantCommandHandlerTests
{
    private readonly Mock<ITenantRepository> _tenantRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();

    [Fact]
    public async Task Handle_ShouldCreateTenant_WhenSlugIsUnique()
    {
        _tenantRepositoryMock.Setup(r => r.SlugExistsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var handler = new CreateTenantCommandHandler(_tenantRepositoryMock.Object, _unitOfWorkMock.Object);
        var command = new CreateTenantCommand("Sunrise Yoga", "sunrise-yoga");

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.Equal("Sunrise Yoga", result.Name);
        Assert.Equal("sunrise-yoga", result.Slug);
        _tenantRepositoryMock.Verify(r => r.Add(It.IsAny<Tenant>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldThrow_WhenSlugAlreadyExists()
    {
        _tenantRepositoryMock.Setup(r => r.SlugExistsAsync("taken-slug", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var handler = new CreateTenantCommandHandler(_tenantRepositoryMock.Object, _unitOfWorkMock.Object);
        var command = new CreateTenantCommand("Another Yoga", "taken-slug");

        await Assert.ThrowsAsync<InvalidOperationException>(() => handler.Handle(command, CancellationToken.None));
    }
}
