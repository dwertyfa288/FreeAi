export interface ModelOption {
  id: string;
  name: string;
}

function requiredElement<T extends Element>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Model picker element is missing: ${selector}`);
  return element;
}

export class ModelPicker {
  private readonly trigger: HTMLButtonElement;
  private readonly valueElement: HTMLElement;
  private readonly menu: HTMLElement;
  private readonly search: HTMLInputElement;
  private readonly optionsElement: HTMLElement;
  private models: ModelOption[] = [];
  private selectedId = "";

  constructor(private readonly root: HTMLElement) {
    this.trigger = requiredElement(root, "[data-picker-trigger]");
    this.valueElement = requiredElement(root, "[data-picker-value]");
    this.menu = requiredElement(root, "[data-picker-menu]");
    this.search = requiredElement(root, "[data-picker-search]");
    this.optionsElement = requiredElement(root, "[data-picker-options]");

    this.trigger.addEventListener("click", () => this.toggle());
    this.search.addEventListener("input", () => this.renderOptions());
    this.search.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.close();
      if (event.key === "Enter") {
        const firstOption = this.optionsElement.querySelector<HTMLButtonElement>("[data-model-id]");
        firstOption?.click();
      }
    });
    this.optionsElement.addEventListener("click", (event) => {
      const option = (event.target as Element).closest<HTMLButtonElement>("[data-model-id]");
      if (!option) return;
      this.selectedId = option.dataset.modelId ?? "";
      this.updateValue();
      this.renderOptions();
      this.close();
    });
    document.addEventListener("click", (event) => {
      if (!this.root.contains(event.target as Node)) this.close();
    });
  }

  setModels(models: ModelOption[], selectedId: string): void {
    this.models = models;
    this.selectedId = models.some((model) => model.id === selectedId) ? selectedId : models[0]?.id ?? "";
    this.updateValue();
    this.renderOptions();
  }

  get value(): string {
    return this.selectedId;
  }

  get selectedName(): string {
    return this.models.find((model) => model.id === this.selectedId)?.name ?? "";
  }

  private toggle(): void {
    if (this.menu.hidden) this.open();
    else this.close();
  }

  private open(): void {
    if (this.models.length === 0) return;
    this.menu.hidden = false;
    this.trigger.setAttribute("aria-expanded", "true");
    this.root.classList.add("open");
    this.search.value = "";
    this.renderOptions();
    window.setTimeout(() => this.search.focus(), 0);
  }

  private close(): void {
    this.menu.hidden = true;
    this.trigger.setAttribute("aria-expanded", "false");
    this.root.classList.remove("open");
  }

  private updateValue(): void {
    this.valueElement.textContent = this.selectedName || "Доступных моделей нет";
    this.trigger.disabled = this.models.length === 0;
  }

  private renderOptions(): void {
    const query = this.search.value.trim().toLocaleLowerCase("ru");
    const visibleModels = query
      ? this.models.filter((model) => model.name.toLocaleLowerCase("ru").includes(query))
      : this.models;
    const options = visibleModels.map((model) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "model-option";
      option.dataset.modelId = model.id;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(model.id === this.selectedId));

      const name = document.createElement("span");
      name.textContent = model.name;
      option.append(name);
      if (model.id === this.selectedId) {
        const check = document.createElement("span");
        check.className = "model-check";
        check.textContent = "✓";
        option.append(check);
      }
      return option;
    });
    if (options.length === 0) {
      const empty = document.createElement("p");
      empty.className = "model-empty";
      empty.textContent = "Ничего не найдено";
      this.optionsElement.replaceChildren(empty);
      return;
    }
    this.optionsElement.replaceChildren(...options);
  }
}
