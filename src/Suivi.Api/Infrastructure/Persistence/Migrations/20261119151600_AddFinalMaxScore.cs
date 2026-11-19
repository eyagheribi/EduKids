using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Suivi.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFinalMaxScore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "FinalMaxScore",
                table: "CompletedSessions",
                type: "TEXT",
                precision: 10,
                scale: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FinalMaxScore",
                table: "CompletedSessions");
        }
    }
}
