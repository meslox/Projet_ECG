import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

interface Props {
  samples: Float64Array
  samplingRateHz: number
}

const HEIGHT = 280

export default function EcgChart({ samples, samplingRateHz }: Props) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const t = new Float64Array(samples.length)
    for (let i = 0; i < t.length; i++) t[i] = i / samplingRateHz

    const plot = new uPlot(
      {
        width: el.clientWidth || 600,
        height: HEIGHT,
        scales: { x: { time: false } },
        series: [{}, { label: 'ECG', stroke: '#dc2626', width: 1 }],
        axes: [{ label: 'Time (s)' }, { label: 'Amplitude (a.u.)' }],
        legend: { show: false },
      },
      [t, samples],
      el,
    )
    const observer = new ResizeObserver(() => {
      if (el.clientWidth > 0) plot.setSize({ width: el.clientWidth, height: HEIGHT })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      plot.destroy()
    }
  }, [samples, samplingRateHz])

  return <div ref={host} className="w-full" />
}
