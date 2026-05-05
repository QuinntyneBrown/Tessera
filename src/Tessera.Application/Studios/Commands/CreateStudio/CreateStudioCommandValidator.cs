using FluentValidation;

namespace Tessera.Application.Studios.Commands.CreateStudio;

public class CreateStudioCommandValidator : AbstractValidator<CreateStudioCommand>
{
    public CreateStudioCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Address).NotEmpty().MaximumLength(500);
        RuleFor(x => x.City).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email));
    }
}
