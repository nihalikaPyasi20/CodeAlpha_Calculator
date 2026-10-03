"use strict";

//Max 15 dgits allowed
const MAX_DIGITS = 15;

//operators mapped with pretty symbol
const OPERATOR_SYMBOLS = { "+": "+", "-": "−", "*": "×", "/": "÷" };

//Conditons for expression using and result
function operate(a, b, operator) {
  let result;

  switch (operator) {
    case "+":
      result = a + b;
      break;
    case "-":
      result = a - b;
      break;
    case "*":
      result = a * b;
      break;
    case "/":
      if (b === 0) return null;
      result = a / b;
      break;
    default:
      return null;
  }

  return Number.isFinite(result) ? result : null;
}

//Instructions to return ans in string form and avoid invalid formats and use scientific notations
function formatNumber(value) {
  if (value === 0) return "0"; // also covers -0

  const rounded = Number(value.toPrecision(15));
  const abs = Math.abs(rounded);
  let text = String(rounded);

  if (abs >= 1e15 || abs < 1e-6 || text.length > 18) {
    text = rounded.toExponential(8).replace(/\.?0+e/, "e");
  }

  return text;
}

//main function of calcultor
function createCalculator() {
  const freshState = () => ({
    current: "0",          // number currently being typed / shown
    previous: null,        // left-hand operand (string) while an operator is pending
    operator: null,        // "+", "-", "*", "/" or null
    awaitingOperand: false, // true right after an operator was pressed
    justEvaluated: false,  // true right after "=" (next digit starts fresh)
    error: false,
    expression: ""         // small line above the main display
  });

  let state = freshState();

  const symbol = (operator) => OPERATOR_SYMBOLS[operator] || operator;
  const toNumber = (text) => parseFloat(text);

  function setError(expression) {
    state = freshState();
    state.error = true;
    state.expression = expression;
  }

  function resetIfError() {
    if (state.error) state = freshState();
  }

  /* Input actions  */

  function inputDigit(digit) {
    resetIfError();

    if (state.justEvaluated) {
      state = freshState();
    }

    if (state.awaitingOperand) {
      state.current = digit;
      state.awaitingOperand = false;
      return;
    }

    if (state.current.replace(/[-.]/g, "").length >= MAX_DIGITS) return;

    if (state.current === "0") {
      state.current = digit;
    } else if (state.current === "-0") {
      state.current = "-" + digit;
    } else {
      state.current += digit;
    }
  }

  function inputDecimal() {
    resetIfError();

    if (state.justEvaluated) {
      state = freshState();
    }

    if (state.awaitingOperand) {
      state.current = "0.";
      state.awaitingOperand = false;
      return;
    }

    if (state.current.includes(".")) return;
    if (state.current.replace(/[-.]/g, "").length >= MAX_DIGITS) return;

    state.current += ".";
  }

  function chooseOperator(operator) {
    if (state.error) return;

    // Alone "-" can start a negative number: "-5", or "5 × -3".
    if (operator === "-") {
      const startingFresh =
        !state.operator && !state.justEvaluated && state.current === "0";
      const negativeAfterTimesOrDivide =
        state.awaitingOperand && (state.operator === "*" || state.operator === "/");

      if (startingFresh || negativeAfterTimesOrDivide) {
        state.current = "-0";
        state.awaitingOperand = false;
        return;
      }
    }

    // Operator pressed twice in a row: just swap the operator.
    if (state.operator && state.awaitingOperand) {
      state.operator = operator;
      state.expression = `${state.previous} ${symbol(operator)}`;
      return;
    }

    // A bare "-0" (sign typed but no digits yet) is not a number yet.
    if (state.current === "-0") return;

    if (state.operator && !state.awaitingOperand) {
      // Chained calculation: 2 + 3 + ... -> evaluate 2 + 3 first.
      const left = toNumber(state.previous);
      const right = toNumber(state.current);
      const result = operate(left, right, state.operator);

      if (result === null) {
        setError(`${formatNumber(left)} ${symbol(state.operator)} ${formatNumber(right)} =`);
        return;
      }

      state.previous = formatNumber(result);
    } else {
      state.previous = formatNumber(toNumber(state.current));
    }

    state.current = state.previous;
    state.operator = operator;
    state.awaitingOperand = true;
    state.justEvaluated = false;
    state.expression = `${state.previous} ${symbol(operator)}`;
  }

  function calculate() {
    if (state.error || !state.operator || state.awaitingOperand) return;

    const left = toNumber(state.previous);
    const right = toNumber(state.current);
    const expression = `${formatNumber(left)} ${symbol(state.operator)} ${formatNumber(right)} =`;
    const result = operate(left, right, state.operator);

    if (result === null) {
      setError(expression);
      return;
    }

    state = freshState();
    state.current = formatNumber(result);
    state.justEvaluated = true;
    state.expression = expression;
  }

  function clear() {
    state = freshState();
  }

  function backspace() {
    if (state.error) {
      state = freshState();
      return;
    }
    if (state.awaitingOperand || state.justEvaluated) return;

    state.current = state.current.slice(0, -1);
    if (state.current === "" || state.current === "-") {
      state.current = "0";
    }
  }

  //for + - toggle sign
  function toggleSign() {
    resetIfError();

    if (state.awaitingOperand) {
      // Start typing a negative number for the pending operation.
      state.current = "-0";
      state.awaitingOperand = false;
      return;
    }

    if (state.current.startsWith("-")) {
      state.current = state.current.slice(1);
    } else {
      state.current = "-" + state.current;
    }
  }

  /*  Read-only view for the UI  */

  function getView() {
    return {
      result: state.error ? "Error" : state.current,
      expression: state.expression,
      activeOperator: state.operator && state.awaitingOperand ? state.operator : null,
      error: state.error
    };
  }

  return {
    inputDigit,
    inputDecimal,
    chooseOperator,
    calculate,
    clear,
    backspace,
    toggleSign,
    getView
  };
}

/* ==========================================================================
   UI wiring (only runs in a browser)
   ========================================================================== */

function initCalculatorUI() {
  const calculator = createCalculator();

  const resultEl = document.getElementById("result");
  const expressionEl = document.getElementById("expression");
  const keypad = document.getElementById("keypad");
  const operatorButtons = keypad.querySelectorAll('[data-action="operator"]');

  function render() {
    const view = calculator.getView();

    resultEl.textContent = view.result;
    resultEl.classList.toggle("is-error", view.error);
    expressionEl.textContent = view.expression;

    // Shrink long numbers so they always fit the display.
    const length = view.result.length;
    const scale = view.error || length <= 10 ? 1 : Math.max(0.5, 10 / length);
    resultEl.style.setProperty("--scale", scale.toFixed(2));

    operatorButtons.forEach((button) => {
      const isActive = button.dataset.value === view.activeOperator;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function handleAction(action, value) {
    switch (action) {
      case "digit":
        calculator.inputDigit(value);
        break;
      case "decimal":
        calculator.inputDecimal();
        break;
      case "operator":
        calculator.chooseOperator(value);
        break;
      case "equals":
        calculator.calculate();
        break;
      case "clear":
        calculator.clear();
        break;
      case "backspace":
        calculator.backspace();
        break;
      case "sign":
        calculator.toggleSign();
        break;
      default:
        return;
    }
    render();
  }

  /* Mouse / touch: event listener  */
  keypad.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button || !keypad.contains(button)) return;
    handleAction(button.dataset.action, button.dataset.value);
  });

  /* Keyboard  */
  function resolveKey(key) {
    if (/^[0-9]$/.test(key)) return { action: "digit", value: key };

    switch (key) {
      case "+":
      case "-":
      case "*":
      case "/":
        return { action: "operator", value: key };
      case "x":
      case "X":
        return { action: "operator", value: "*" };
      case ".":
      case ",":
        return { action: "decimal" };
      case "Enter":
      case "=":
        return { action: "equals" };
      case "Escape":
        return { action: "clear" };
      case "Backspace":
        return { action: "backspace" };
      default:
        return null;
    }
  }

  function findButton(action, value) {
    const buttons = keypad.querySelectorAll(`button[data-action="${action}"]`);
    return Array.from(buttons).find(
      (button) => value === undefined || button.dataset.value === value
    );
  }

  function flashButton(button) {
    if (!button) return;
    button.classList.add("is-pressed");
    window.setTimeout(() => button.classList.remove("is-pressed"), 120);
  }

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const mapped = resolveKey(event.key);
    if (!mapped) return;

    // Stops "/" quick-find, and stops Enter from also "clicking" a focused button.
    event.preventDefault();

    handleAction(mapped.action, mapped.value);
    flashButton(findButton(mapped.action, mapped.value));
  });

  render();
}

if (typeof document !== "undefined") {
  initCalculatorUI();
}

// Allows the logic to be tested in Node without a browser.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { createCalculator, operate, formatNumber };
}
