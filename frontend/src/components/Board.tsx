import {
  closestCenter,
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  getFirstCollision,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, Board as BoardT, Card, List } from "../api";
import { CardFace } from "./CardFace";

const colKey = (id: number) => `c${id}`;
const cardKey = (id: number) => `k${id}`;
const isCol = (k: UniqueIdentifier | null | undefined) => typeof k === "string" && k.startsWith("c");
const idOf = (k: UniqueIdentifier) => Number(String(k).slice(1));

type Props = {
  board: BoardT;
  onBoardChange: (b: BoardT) => void;
  onOpenCard: (c: Card) => void;
  reload: () => void;
};

export function Board({ board, onBoardChange, onOpenCard, reload }: Props) {
  const [lists, setLists] = useState<List[]>(board.lists);
  const [active, setActive] = useState<UniqueIdentifier | null>(null);
  const lastOver = useRef<UniqueIdentifier | null>(null);
  const draggedRecently = useRef(false);
  const snapshot = useRef<List[] | null>(null);

  useEffect(() => setLists(board.lists), [board]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const listIndexOf = useCallback(
    (k: UniqueIdentifier, from: List[] = lists) => {
      if (isCol(k)) return from.findIndex((l) => l.id === idOf(k));
      return from.findIndex((l) => l.cards.some((c) => c.id === idOf(k)));
    },
    [lists],
  );

  const collision: CollisionDetection = useCallback(
    (args) => {
      if (isCol(active)) {
        return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => isCol(c.id)) });
      }
      const pointer = pointerWithin(args);
      const hits = pointer.length > 0 ? pointer : rectIntersection(args);
      let overId = getFirstCollision(hits, "id");
      if (overId != null) {
        if (isCol(overId)) {
          const l = lists.find((x) => x.id === idOf(overId!));
          if (l && l.cards.length > 0) {
            const inner = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (c) => !isCol(c.id) && l.cards.some((card) => cardKey(card.id) === c.id),
              ),
            });
            if (inner[0]) overId = inner[0].id;
          }
        }
        lastOver.current = overId;
        return [{ id: overId }];
      }
      return lastOver.current ? [{ id: lastOver.current }] : [];
    },
    [active, lists],
  );

  function onDragStart(e: DragStartEvent) {
    setActive(e.active.id);
    snapshot.current = lists;
  }

  function onDragOver({ active: a, over }: DragOverEvent) {
    if (!over || isCol(a.id)) return;
    const from = listIndexOf(a.id);
    const to = listIndexOf(over.id);
    if (from < 0 || to < 0 || from === to) return;
    setLists((prev) => {
      const next = prev.map((l) => ({ ...l, cards: [...l.cards] }));
      const ci = next[from].cards.findIndex((c) => c.id === idOf(a.id));
      if (ci < 0) return prev;
      const [moved] = next[from].cards.splice(ci, 1);
      let at = next[to].cards.length;
      if (!isCol(over.id)) {
        const oi = next[to].cards.findIndex((c) => c.id === idOf(over.id));
        const below =
          a.rect.current.translated && a.rect.current.translated.top > over.rect.top + over.rect.height / 2;
        at = oi >= 0 ? oi + (below ? 1 : 0) : at;
      }
      next[to].cards.splice(at, 0, { ...moved, list_id: next[to].id });
      return next;
    });
  }

  function onDragEnd({ active: a, over }: DragEndEvent) {
    setActive(null);
    draggedRecently.current = true;
    setTimeout(() => (draggedRecently.current = false), 150);
    if (!over) {
      if (snapshot.current) setLists(snapshot.current);
      return;
    }
    let next = lists;
    if (isCol(a.id)) {
      const fi = listIndexOf(a.id);
      const ti = listIndexOf(over.id);
      if (fi >= 0 && ti >= 0 && fi !== ti) next = arrayMove(lists, fi, ti);
    } else {
      const li = listIndexOf(a.id);
      const oi = listIndexOf(over.id);
      if (li >= 0 && li === oi && !isCol(over.id)) {
        const cards = lists[li].cards;
        const fi = cards.findIndex((c) => c.id === idOf(a.id));
        const ti = cards.findIndex((c) => c.id === idOf(over.id));
        if (fi !== ti) next = lists.map((l, i) => (i === li ? { ...l, cards: arrayMove(cards, fi, ti) } : l));
      }
    }
    setLists(next);
    const before = JSON.stringify(snapshot.current?.map((l) => [l.id, l.cards.map((c) => c.id)]));
    const after = JSON.stringify(next.map((l) => [l.id, l.cards.map((c) => c.id)]));
    if (before === after) return;
    api
      .layout(board.id, next.map((l) => ({ id: l.id, card_ids: l.cards.map((c) => c.id) })))
      .then(onBoardChange)
      .catch(() => reload());
  }

  const activeCard = active && !isCol(active) ? lists.flatMap((l) => l.cards).find((c) => c.id === idOf(active)) : null;
  const activeList = active && isCol(active) ? lists.find((l) => l.id === idOf(active)) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActive(null);
        if (snapshot.current) setLists(snapshot.current);
      }}
    >
      <div className="board" data-testid="board">
        <SortableContext items={lists.map((l) => colKey(l.id))} strategy={horizontalListSortingStrategy}>
          {lists.map((l) => (
            <Column
              key={l.id}
              list={l}
              onOpenCard={(c) => !draggedRecently.current && onOpenCard(c)}
              reload={reload}
            />
          ))}
        </SortableContext>
        <AddColumn boardId={board.id} reload={reload} />
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" }}>
        {activeCard ? (
          <div className="card dragging-overlay">
            <CardFace card={activeCard} done={false} />
          </div>
        ) : activeList ? (
          <div className="column dragging-overlay">
            <div className="column-head">
              <h3>{activeList.title}</h3>
              <span className="count">{activeList.cards.length}</span>
            </div>
            <div className="cards">
              {activeList.cards.slice(0, 6).map((c) => (
                <div key={c.id} className="card">
                  <CardFace card={c} done={activeList.is_done} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ list, onOpenCard, reload }: { list: List; onOpenCard: (c: Card) => void; reload: () => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: colKey(list.id),
    data: { type: "column" },
  });
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <section
      ref={setNodeRef}
      className={`column ${isDragging ? "is-dragging" : ""} ${list.is_done ? "done-col" : ""}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-testid={`column-${list.title}`}
    >
      <div className="column-head" {...attributes} {...listeners} aria-label={`Column ${list.title}, drag to move`}>
        {renaming ? (
          <input
            className="inline-input"
            autoFocus
            defaultValue={list.title}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setRenaming(false);
            }}
            onBlur={async (e) => {
              const v = e.target.value.trim();
              setRenaming(false);
              if (v && v !== list.title) {
                await api.patchList(list.id, { title: v });
                reload();
              }
            }}
          />
        ) : (
          <h3 onDoubleClick={() => setRenaming(true)}>
            {list.is_done && <span className="done-mark">✓</span>}
            {list.title}
          </h3>
        )}
        <span className="count">{list.cards.length}</span>
        <button
          className="icon-btn"
          aria-label="Column menu"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={() => {
            setMenu((m) => !m);
            setConfirmDelete(false);
          }}
        >
          ⋯
        </button>
        {menu && (
          <div className="popover" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            <button onClick={() => (setMenu(false), setRenaming(true))}>Rename</button>
            <button
              onClick={async () => {
                setMenu(false);
                await api.patchList(list.id, { is_done: !list.is_done });
                reload();
              }}
            >
              {list.is_done ? "Unmark as “done” column" : "Mark as “done” column"}
            </button>
            {confirmDelete ? (
              <div className="confirm">
                <span>Delete “{list.title}”{list.cards.length ? ` and ${list.cards.length} cards` : ""}?</span>
                <div>
                  <button className="danger" onClick={async () => (await api.deleteList(list.id), reload())}>
                    Delete
                  </button>
                  <button onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="danger-text" onClick={() => setConfirmDelete(true)}>
                Delete column
              </button>
            )}
          </div>
        )}
      </div>
      <SortableContext items={list.cards.map((c) => cardKey(c.id))} strategy={verticalListSortingStrategy}>
        <div className="cards">
          {list.cards.map((c) => (
            <SortableCard key={c.id} card={c} done={list.is_done} onOpen={() => onOpenCard(c)} />
          ))}
          {list.cards.length === 0 && <div className="empty-drop">Drop cards here</div>}
        </div>
      </SortableContext>
      <AddCard listId={list.id} reload={reload} />
    </section>
  );
}

function SortableCard({ card, done, onOpen }: { card: Card; done: boolean; onOpen: () => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: cardKey(card.id),
    data: { type: "card" },
  });
  return (
    <div
      ref={setNodeRef}
      className={`card ${isDragging ? "is-dragging" : ""} ${done ? "is-done" : ""}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-testid={`card-${card.title}`}
      onClick={onOpen}
      {...attributes}
      {...listeners}
    >
      <CardFace card={card} done={done} />
    </div>
  );
}

function AddCard({ listId, reload }: { listId: number; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await api.addCard(listId, t);
    reload();
  };
  if (!open)
    return (
      <button className="add-card" onClick={() => setOpen(true)}>
        + Add a card
      </button>
    );
  return (
    <div className="add-card-form">
      <textarea
        autoFocus
        rows={2}
        placeholder="What needs doing?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <div className="row">
        <button className="primary" onClick={submit}>
          Add card
        </button>
        <button className="ghost" onClick={() => (setOpen(false), setText(""))}>
          ✕
        </button>
      </div>
    </div>
  );
}

function AddColumn({ boardId, reload }: { boardId: number; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    await api.addList(boardId, t);
    setText("");
    setOpen(false);
    reload();
  };
  return (
    <div className="column add-column">
      {open ? (
        <div className="add-card-form">
          <input
            autoFocus
            placeholder="Column name"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <div className="row">
            <button className="primary" onClick={submit}>
              Add column
            </button>
            <button className="ghost" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
        </div>
      ) : (
        <button className="add-card" onClick={() => setOpen(true)}>
          + Add column
        </button>
      )}
    </div>
  );
}
