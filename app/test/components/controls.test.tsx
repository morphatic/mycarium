import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ThresholdEditor } from "../../src/components/ThresholdEditor";
import { StandbyButton } from "../../src/components/StandbyButton";

describe("ThresholdEditor", () => {
  afterEach(cleanup);

  it("calls onSave with valid values", () => {
    const onSave = vi.fn();
    render(
      <ThresholdEditor label="Temperature" unit="°C" min={20} max={28} onSave={onSave} />,
    );

    fireEvent.click(screen.getByText("Set"));

    expect(onSave).toHaveBeenCalledWith(20, 28);
  });

  it("shows error when max <= min", () => {
    const onSave = vi.fn();
    render(
      <ThresholdEditor label="Temperature" unit="°C" min={20} max={28} onSave={onSave} />,
    );

    const inputs = screen.getAllByRole("spinbutton");
    // Set min > max
    fireEvent.change(inputs[0]!, { target: { value: "30" } });
    fireEvent.change(inputs[1]!, { target: { value: "25" } });
    fireEvent.click(screen.getByText("Set"));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Maximum must be greater than minimum",
    );
  });

  it("shows error for non-numeric input", () => {
    const onSave = vi.fn();
    render(
      <ThresholdEditor label="Humidity" unit="%" min={70} max={90} onSave={onSave} />,
    );

    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0]!, { target: { value: "" } });
    fireEvent.click(screen.getByText("Set"));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter valid numbers");
  });
});

describe("StandbyButton", () => {
  afterEach(cleanup);

  it("shows Enter Standby when not in standby", () => {
    const onEnter = vi.fn();
    render(
      <StandbyButton isStandby={false} onEnter={onEnter} onExit={vi.fn()} />,
    );

    fireEvent.click(screen.getByText("Enter Standby"));
    expect(onEnter).toHaveBeenCalled();
  });

  it("shows Resume when in standby", () => {
    const onExit = vi.fn();
    render(
      <StandbyButton isStandby={true} onEnter={vi.fn()} onExit={onExit} />,
    );

    fireEvent.click(screen.getByText("Resume Auto Mode"));
    expect(onExit).toHaveBeenCalled();
  });
});
