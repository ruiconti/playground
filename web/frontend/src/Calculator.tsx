import { useState, useRef } from "react"
import { cn } from "./lib/utils";

type Operator2 = 'add' | 'sub' | 'mult' | 'div'
type Operator1 = 'invert' | 'percent'

const operatorLabel: Record<Operator1 | Operator2, string> = {
  add: '+',
  sub: '-',
  mult: '*',
  div: '/',
  percent: '%',
  invert: '+/-'
}

function calculate1(op: Operator1, a: number) {
  switch (op) {
    case 'percent':
      return a / 1000
    case 'invert':
      return a * -1
  }
}

function calculate2(op: Operator2, a: number, b: number) {
  switch (op) {
    case 'add':
      return a + b;
    case 'sub':
      return a - b;
    case 'div':
      return a / b;
    case 'mult':
      return a * b;
  }
}


export function Calculator() {
  const [operator, setOperator] = useState<Operator2 | null>(null)
  const [display, setDisplay] = useState<string>('0')

  const accRef = useRef(0)
  const flushNextRef = useRef(false);

  const setResult = (num: number) => {
    setDisplay(num.toString());
    accRef.current = num;
  }

  const inputNumber = (num: number) => {
    let base: string;
    if (flushNextRef.current) {
      flushNextRef.current = false;
      base = '0';
    } else {
      base = display
    }

    const decoded = parseFloat(base + num.toString())
    const encoded = decoded.toString();

    setDisplay(encoded);
  }

  const toOperation = (op: Operator2) => {
    flushNextRef.current = true;
    setOperator(op);

    const snapshot = parseFloat(display)
    if (operator) {
      const result = calculate2(op, accRef.current, snapshot);
      setResult(result)
    } else {
      accRef.current = snapshot;
    }
  }

  const toEqual = () => {
    if (!operator) {
      console.warn('No operator!')
      return;
    }

    const snapshot = parseFloat(display)
    const result = calculate2(operator, accRef.current, snapshot);
    setResult(result);
    setOperator(null);

    flushNextRef.current = true
  }

  const reset = () => {
    setOperator(null);
    accRef.current = 0;
    setDisplay('0')
  }

  const toOperatorUni = (op: Operator1) => {
    const snapshot = parseFloat(display)
    const result = calculate1(op, snapshot)

    setResult(result);
    setOperator(null)
  }

  const renderOperator = (op: Operator2) => {
    return (
      <div className={cn("w-full flex items-center justify-center", operator === op ? 'bg-orange-700' : 'bg-orange-500')} onClick={() => toOperation(op)}>{operatorLabel[op]}</div>
    )
  }

  const renderOperator1 = (op: Operator1) => {
    return (
      <div className="w-full flex items-center justify-center" onClick={() => toOperatorUni(op)}>{operatorLabel[op]}</div>
    )
  }

  return (
    <div className="w-full h-dvh flex flex-col">
      <div className="bg-slate-800 w-full h-[100px] text-8xl text-right">
        {display}
      </div>
      <div className="bg-slate-800 w-full h-[100px] flex flex-row">
        <div className="w-full flex items-center justify-center" onClick={() => reset()}>AC</div>
        {renderOperator1('invert')}
        {renderOperator1('percent')}
        {renderOperator('div')}
      </div>
      <div className="bg-slate-800 w-full h-[100px] flex flex-row">
        <div className="w-full flex items-center justify-center" onClick={() => inputNumber(7)} >7</div>
        <div className="w-full flex items-center justify-center" onClick={() => inputNumber(8)}>8</div>
        <div className="w-full flex items-center justify-center" onClick={() => inputNumber(9)}>9</div>
        {renderOperator('mult')}
      </div>
      <div className="bg-slate-800 w-full h-[100px] flex flex-row">
        <div className="w-full flex items-center justify-center" onClick={() => inputNumber(4)}>4</div>
        <div className="w-full flex items-center justify-center" onClick={() => inputNumber(5)}>5</div>
        <div className="w-full flex items-center justify-center" onClick={() => inputNumber(6)}>6</div>
        {renderOperator('sub')}
      </div>
      <div className="bg-slate-800 w-full h-[100px] flex flex-row">
        <div className="w-full flex items-center justify-center" onClick={() => inputNumber(1)}>1</div>
        <div className="w-full flex items-center justify-center" onClick={() => inputNumber(2)}>2</div>
        <div className="w-full flex items-center justify-center" onClick={() => inputNumber(3)}>3</div>
        {renderOperator('add')}
      </div>
      <div className="bg-slate-800 w-full h-[100px] flex flex-row">
        <div className="w-full flex items-center justify-center" onClick={() => inputNumber(0)}>0</div>
        <div className="w-full w-[50%] flex items-center justify-center">.</div>
        <div className="w-full w-[50%] flex items-center justify-center" onClick={() => toEqual()}>=</div>
      </div>
    </div>

  );
}
