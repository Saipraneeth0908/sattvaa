import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

export default function ProductionLogTab({
  selectedDay,
  saveProductionDay,
  saveLoading,
  saveMessage,
  onExport,
  updateSelectedDay,
  appState,
  products,
  roundOptions,
  slotOptions,
  resizeProductionRounds,
  buildWaterIceStepsFromStart,
}) {
  if (!selectedDay) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6 text-slate-500">Select or create a production day in Orders & Planning to begin logging rounds, timing, QC, and transfer data.</CardContent>
      </Card>
    )
  }

  const slotCount = selectedDay.rounds[0]?.grinders?.length || appState.company.grinders

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle>Production Log - Daily Data Sheet</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={onExport} className="rounded-2xl">
              Export XLS
            </Button>
            <Button onClick={saveProductionDay} disabled={saveLoading} className="rounded-2xl">
              {saveLoading ? 'Saving…' : 'Save Production Log'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-4 bg-slate-50">
            <Label>Date</Label>
            <Input
              type="date"
              className="mt-3 bg-white"
              value={selectedDay.date}
              onChange={(e) =>
                updateSelectedDay((day) => ({
                  ...day,
                  date: e.target.value,
                }))
              }
            />
          </div>
          <div className="rounded-2xl border p-4 bg-slate-50">
            <Label>Rounds</Label>
            <Select
              value={String(selectedDay.rounds.length)}
              onValueChange={(value) =>
                updateSelectedDay((day) =>
                  resizeProductionRounds(day, Number(value), day.rounds[0]?.grinders?.length || appState.company.grinders, appState.company)
                )
              }
            >
              <SelectTrigger className="mt-3 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roundOptions.map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count} rounds
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-2xl border p-4 bg-slate-50">
            <Label>Batch slots per round</Label>
            <Select
              value={String(slotCount)}
              onValueChange={(value) =>
                updateSelectedDay((day) => resizeProductionRounds(day, day.rounds.length, Number(value), appState.company))
              }
            >
              <SelectTrigger className="mt-3 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {slotOptions.map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count} slots
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedDay.rounds.map((round) => {
        const machineList = round.grinders.map((batch) => batch.batchLabel || `${batch.productCode || 'Batch'}${batch.grinderNo}`).join(', ')
        const waterSteps = buildWaterIceStepsFromStart(round.startedAt || '')

        return (
          <Card key={round.id} className="rounded-2xl">
            <CardHeader>
              <CardTitle>Round {round.roundNo}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <div className="text-sm font-semibold">Machines</div>
                  <div className="mt-2 text-sm text-slate-600">{machineList}</div>
                  <div className="mt-4 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Machine</TableHead>
                          <TableHead>Batter type</TableHead>
                          <TableHead>Batch name</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {round.grinders.map((batch) => (
                          <TableRow key={batch.id}>
                            <TableCell className="font-medium">{batch.batchLabel || `Machine ${batch.grinderNo}`}</TableCell>
                            <TableCell className="min-w-36">
                              <Select
                                value={batch.productCode}
                                onValueChange={(value) =>
                                  updateSelectedDay((day) => ({
                                    ...day,
                                    rounds: day.rounds.map((r) =>
                                      r.id === round.id
                                        ? {
                                            ...r,
                                            grinders: r.grinders.map((g) =>
                                              g.id === batch.id
                                                ? { ...g, productCode: value, productName: products.find((p) => p.code === value)?.name || '' }
                                                : g
                                            ),
                                          }
                                        : r
                                    ),
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select batter" />
                                </SelectTrigger>
                                <SelectContent>
                                  {products.map((product) => (
                                    <SelectItem key={product.code} value={product.code}>
                                      {product.code}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="min-w-40">
                              <Input
                                value={batch.batchLabel}
                                onChange={(e) =>
                                  updateSelectedDay((day) => ({
                                    ...day,
                                    rounds: day.rounds.map((r) =>
                                      r.id === round.id
                                        ? {
                                            ...r,
                                            grinders: r.grinders.map((g) =>
                                              g.id === batch.id ? { ...g, batchLabel: e.target.value } : g
                                            ),
                                          }
                                        : r
                                    ),
                                  }))
                                }
                                placeholder={`${batch.productCode || 'KMB'}${batch.grinderNo}`}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <div className="text-sm font-semibold">Batch Timing</div>
                  <div className="mt-4 grid gap-4">
                    <div>
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        className="mt-2 bg-white"
                        value={round.startedAt || ''}
                        onChange={(e) =>
                          updateSelectedDay((day) => ({
                            ...day,
                            rounds: day.rounds.map((r) =>
                              r.id === round.id
                                ? {
                                    ...r,
                                    startedAt: e.target.value,
                                    grinders: r.grinders.map((g) => ({
                                      ...g,
                                      startedAt: e.target.value,
                                      waterIceSteps: buildWaterIceStepsFromStart(e.target.value),
                                    })),
                                  }
                                : r
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Stop Time</Label>
                      <Input
                        type="time"
                        className="mt-2 bg-white"
                        value={round.endedAt || ''}
                        onChange={(e) =>
                          updateSelectedDay((day) => ({
                            ...day,
                            rounds: day.rounds.map((r) =>
                              r.id === round.id
                                ? {
                                    ...r,
                                    endedAt: e.target.value,
                                    grinders: r.grinders.map((g) => ({ ...g, endedAt: e.target.value })),
                                  }
                                : r
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <div className="text-sm font-semibold">Process Steps (Water Addition Timeline)</div>
                <Table className="mt-3">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {waterSteps.map((step, index) => (
                      <TableRow key={`${round.id}-step-${index}`}>
                        <TableCell>{step.time || '--:--'}</TableCell>
                        <TableCell>{step.action}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell>{round.endedAt || '--:--'}</TableCell>
                      <TableCell>Stop</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-semibold">Time to Transfer to Grinder</div>
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Machine</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>Stop</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {round.grinders.map((batch) => (
                        <TableRow key={`grain-${batch.id}`}>
                          <TableCell>{batch.batchLabel || `${batch.productCode || 'Batch'}${batch.grinderNo}`}</TableCell>
                          <TableCell className="w-36">
                            <Input
                              type="time"
                              value={batch.grainTransferStart}
                              onChange={(e) =>
                                updateSelectedDay((day) => ({
                                  ...day,
                                  rounds: day.rounds.map((r) =>
                                    r.id === round.id
                                      ? {
                                          ...r,
                                          grinders: r.grinders.map((g) =>
                                            g.id === batch.id ? { ...g, grainTransferStart: e.target.value } : g
                                          ),
                                        }
                                      : r
                                  ),
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell className="w-36">
                            <Input
                              type="time"
                              value={batch.grainTransferEnd}
                              onChange={(e) =>
                                updateSelectedDay((day) => ({
                                  ...day,
                                  rounds: day.rounds.map((r) =>
                                    r.id === round.id
                                      ? {
                                          ...r,
                                          grinders: r.grinders.map((g) =>
                                            g.id === batch.id ? { ...g, grainTransferEnd: e.target.value } : g
                                          ),
                                        }
                                      : r
                                  ),
                                }))
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-semibold">Time to Transfer to Fermenter</div>
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Machine</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>Stop</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {round.grinders.map((batch) => (
                        <TableRow key={`ferment-${batch.id}`}>
                          <TableCell>{batch.batchLabel || `${batch.productCode || 'Batch'}${batch.grinderNo}`}</TableCell>
                          <TableCell className="w-36">
                            <Input
                              type="time"
                              value={batch.batterTransferStart}
                              onChange={(e) =>
                                updateSelectedDay((day) => ({
                                  ...day,
                                  rounds: day.rounds.map((r) =>
                                    r.id === round.id
                                      ? {
                                          ...r,
                                          grinders: r.grinders.map((g) =>
                                            g.id === batch.id ? { ...g, batterTransferStart: e.target.value } : g
                                          ),
                                        }
                                      : r
                                  ),
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell className="w-36">
                            <Input
                              type="time"
                              value={batch.batterTransferEnd}
                              onChange={(e) =>
                                updateSelectedDay((day) => ({
                                  ...day,
                                  rounds: day.rounds.map((r) =>
                                    r.id === round.id
                                      ? {
                                          ...r,
                                          grinders: r.grinders.map((g) =>
                                            g.id === batch.id ? { ...g, batterTransferEnd: e.target.value } : g
                                          ),
                                        }
                                      : r
                                  ),
                                }))
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <div className="text-sm font-semibold">Batch Observation Table</div>
                <div className="overflow-x-auto">
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batter Type</TableHead>
                        <TableHead>Batter Temp</TableHead>
                        <TableHead>Room Temp</TableHead>
                        <TableHead>pH</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {round.grinders.map((batch) => (
                        <TableRow key={`obs-${batch.id}`}>
                          <TableCell className="min-w-36">{batch.batchLabel || batch.productCode || `Machine ${batch.grinderNo}`}</TableCell>
                          <TableCell className="w-32">
                            <Input
                              value={batch.batterTemp}
                              onChange={(e) =>
                                updateSelectedDay((day) => ({
                                  ...day,
                                  rounds: day.rounds.map((r) =>
                                    r.id === round.id
                                      ? {
                                          ...r,
                                          grinders: r.grinders.map((g) =>
                                            g.id === batch.id ? { ...g, batterTemp: e.target.value } : g
                                          ),
                                        }
                                      : r
                                  ),
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell className="w-32">
                            <Input
                              value={batch.roomTemp}
                              onChange={(e) =>
                                updateSelectedDay((day) => ({
                                  ...day,
                                  rounds: day.rounds.map((r) =>
                                    r.id === round.id
                                      ? {
                                          ...r,
                                          grinders: r.grinders.map((g) =>
                                            g.id === batch.id ? { ...g, roomTemp: e.target.value } : g
                                          ),
                                        }
                                      : r
                                  ),
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell className="w-28">
                            <Input
                              value={batch.ph}
                              onChange={(e) =>
                                updateSelectedDay((day) => ({
                                  ...day,
                                  rounds: day.rounds.map((r) =>
                                    r.id === round.id
                                      ? {
                                          ...r,
                                          grinders: r.grinders.map((g) =>
                                            g.id === batch.id ? { ...g, ph: e.target.value } : g
                                          ),
                                        }
                                      : r
                                  ),
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell className="w-32">
                            <Input
                              type="time"
                              value={batch.qcRecordedAt || batch.qcTime}
                              onChange={(e) =>
                                updateSelectedDay((day) => ({
                                  ...day,
                                  rounds: day.rounds.map((r) =>
                                    r.id === round.id
                                      ? {
                                          ...r,
                                          grinders: r.grinders.map((g) =>
                                            g.id === batch.id ? { ...g, qcRecordedAt: e.target.value, qcTime: e.target.value } : g
                                          ),
                                        }
                                      : r
                                  ),
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell className="min-w-48">
                            <Textarea
                              value={batch.qcNotes}
                              onChange={(e) =>
                                updateSelectedDay((day) => ({
                                  ...day,
                                  rounds: day.rounds.map((r) =>
                                    r.id === round.id
                                      ? {
                                          ...r,
                                          grinders: r.grinders.map((g) =>
                                            g.id === batch.id ? { ...g, qcNotes: e.target.value } : g
                                          ),
                                        }
                                      : r
                                  ),
                                }))
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          {saveMessage || `Default setup: ${appState.company.defaultRoundsPerDay} rounds, ${slotCount} slots per round.`}
        </div>
      </div>
    </div>
  )
}
