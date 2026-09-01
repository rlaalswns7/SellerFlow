import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const menus = [
  ["대시보드", "⌂"],
  ["주문내역", "▣"],
  ["도매처 관리", "⌂"],
  ["상품 연결", "◫"],
  ["운송장 관리", "◇"],
  ["CS 관리", "◌"],
  ["마진 계산기", "₩"],
  ["설정", "⚙"],
];

const orders = [
  {
    id: "C10001",
    date: "08/29",
    customer: "홍길동",
    product: "사과 5kg",
   option: "5kg / 특품",
qty: 1,
saleAmount: 32900,
purchaseStatus: "발주대기",
invoiceStatus: "송장대기",
    supplier: "A농장",
    link: "연결완료",
    invoice: "대기",
  },
  {
    id: "C10002",
    date: "08/29",
    customer: "김민준",
    product: "토마토 2kg",
    option: "2kg",
qty: 1,
saleAmount: 21900,
purchaseStatus: "도매처 연결 필요",
invoiceStatus: "송장대기",
    supplier: "미연결",
    link: "연결필요",
    invoice: "대기",
  },
  {
    id: "C10003",
    date: "08/28",
    customer: "이서준",
    product: "복숭아 3kg",
  option: "3kg / 특",
qty: 1,
saleAmount: 27900,
purchaseStatus: "발주완료",
invoiceStatus: "쿠팡 등록 가능",  supplier: "C농장",
    link: "연결완료",
    invoice: "등록가능",
  },
];

const sales30 = [
  ["07/31",4,125000],["08/01",5,161000],["08/02",3,98000],
  ["08/03",7,244000],["08/04",6,202000],["08/05",8,276000],
  ["08/06",4,139000],["08/07",5,174000],["08/08",9,318000],
  ["08/09",6,207000],["08/10",7,248000],["08/11",11,391000],
  ["08/12",8,286000],["08/13",6,215000],["08/14",10,352000],
  ["08/15",12,428000],["08/16",9,321000],["08/17",7,249000],
  ["08/18",8,293000],["08/19",13,471000],["08/20",10,365000],
  ["08/21",12,439000],["08/22",9,337000],["08/23",14,512000],
  ["08/24",11,406000],["08/25",15,548000],["08/26",12,442000],
  ["08/27",16,596000],["08/28",14,527000],["08/29",18,684000],
].map(([date, orderCount, revenue]) => ({
  date,
  orderCount,
  revenue,
}));

function App() {
  const [page, setPage] = useState("대시보드");

  return (
    <div className="app">
      <aside>
        <div className="logo">
          <i>S</i>
          <b>Seller<span>Flow</span></b>
        </div>

        <div className="workspace">
          <b>내 판매센터</b>
          <small>● 운영 준비 중</small>
        </div>

        {menus.map(([name, icon]) => (
          <button
            key={name}
            className={page === name ? "active" : ""}
            onClick={() => setPage(name)}
          >
            <em>{icon}</em>
            {name}
          </button>
        ))}
      </aside>

      <main>
        <header>
          SellerFlow / <b>{page}</b>
        </header>

        <section className="content">
          {page === "대시보드" ? (
  <Dashboard />
) : page === "주문내역" ? (
  <OrderPage />
) : page === "도매처 관리" ? (
  <SupplierPage />
) : (
  <EmptyPage title={page} />
)}
        </section>
      </main>
    </div>
  );
}

function Dashboard() {
  const [range, setRange] = useState(7);

  const data = useMemo(
    () => sales30.slice(-range),
    [range]
  );

  return (
    <>
      <div className="head">
        <div>
          <h1>대시보드</h1>
          <p>
            주문부터 운송장 등록까지 현재 자동화 상태를 확인하세요.
          </p>
        </div>
      </div>

      <div className="cards">
        <StatusCard
          count="1"
          title="연결 필요"
          description="도매처 연결 필요"
        />

        <StatusCard
          count="2"
          title="주문서 대기"
          description="도매처에 엑셀 전달"
        />

        <StatusCard
          count="2"
          title="운송장 대기"
          description="도매처에 송장 받기"
        />

        <StatusCard
          count="1"
          title="쿠팡 등록 가능"
          description="자동 등록 준비됨"
        />
      </div>

      <div className="panel">
        <div className="panelHead">
          <div>
            <h2>판매 분석</h2>
            <p>일별 주문수와 매출 흐름</p>
          </div>

          <div className="tabs">
            {[7, 15, 30].map((n) => (
              <button
                key={n}
                className={range === n ? "on" : ""}
                onClick={() => setRange(n)}
              >
                {n}일
              </button>
            ))}
          </div>
        </div>

        <SalesChart data={data} />

        <div className="legend">
          <span className="purpleDot" /> 주문수
          <span className="greenDot" /> 매출(원)
        </div>
      </div>

      <div className="panel">
        <div className="panelHead">
          <div>
            <h2>최근 주문내역</h2>
            <p>최근 들어온 주문의 처리 상태</p>
          </div>
        </div>

        <OrderTable rows={orders} />
      </div>
    </>
  );
}

function StatusCard({ count, title, description }) {
  return (
    <div className="card">
      <div className="cardTop">
        <span>처리 현황</span>
        <i>→</i>
      </div>

      <strong>
        {count}<small>건</small>
      </strong>

      <b>{title}</b>
      <p>{description}</p>
    </div>
  );
}

function SalesChart({ data }) {
  const width = 1000;
  const height = 280;
  const left = 45;
  const right = 20;
  const top = 20;
  const bottom = 40;

  const maxOrders = Math.max(...data.map((d) => d.orderCount), 1);
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  const x = (i) =>
    left +
    i * ((width - left - right) / Math.max(data.length - 1, 1));

  const orderY = (value) =>
    top +
    (height - top - bottom) * (1 - value / maxOrders);

  const revenueY = (value) =>
    top +
    (height - top - bottom) * (1 - value / maxRevenue);

  const orderPoints = data
    .map((d, i) => `${x(i)},${orderY(d.orderCount)}`)
    .join(" ");

  const revenuePoints = data
    .map((d, i) => `${x(i)},${revenueY(d.revenue)}`)
    .join(" ");

  return (
    <div className="chartWrap">
      <svg viewBox={`0 0 ${width} ${height}`}>
        {[0, 1, 2, 3, 4].map((n) => {
          const y =
            top + n * ((height - top - bottom) / 4);

          return (
            <line
              key={n}
              x1={left}
              x2={width - right}
              y1={y}
              y2={y}
              className="grid"
            />
          );
        })}

        <polyline
          points={orderPoints}
          className="orderLine"
        />

        <polyline
          points={revenuePoints}
          className="revenueLine"
        />

        {data.map((d, i) => (
          <React.Fragment key={d.date}>
            <circle
              cx={x(i)}
              cy={orderY(d.orderCount)}
              r="4"
              className="orderPoint"
            />

            <circle
              cx={x(i)}
              cy={revenueY(d.revenue)}
              r="4"
              className="revenuePoint"
            />
<text
  x={x(i)}
  y={revenueY(d.revenue) - 14}
  textAnchor="middle"
  className="revenueLabel"
>
  ₩{d.revenue.toLocaleString()}
</text>
            {(data.length <= 7 ||
              i % (data.length === 15 ? 2 : 5) === 0 ||
              i === data.length - 1) && (
              <text
                x={x(i)}
                y={height - 13}
                textAnchor="middle"
              >
                {d.date}
              </text>
            )}
          </React.Fragment>
        ))}
      </svg>
    </div>
  );
}

function OrderPage() {
  const [selected, setSelected] = useState([]);

  const toggleOrder = (id) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const selectableOrders = orders.filter(
    (o) => o.supplier !== "미연결"
  );

  const toggleAll = () => {
    if (selected.length === selectableOrders.length) {
      setSelected([]);
    } else {
      setSelected(selectableOrders.map((o) => o.id));
    }
  };

  const createPurchaseOrder = () => {
    const targetOrders = orders.filter((o) =>
      selected.includes(o.id)
    );

    if (targetOrders.length === 0) {
      alert("발주할 주문을 선택해주세요.");
      return;
    }

    const grouped = targetOrders.reduce((acc, order) => {
      if (!acc[order.supplier]) {
        acc[order.supplier] = [];
      }

      acc[order.supplier].push(order);
      return acc;
    }, {});

    const rows = [
      [
        "도매처",
        "주문번호",
        "주문일",
        "고객명",
        "상품명",
      ],
    ];

    Object.entries(grouped).forEach(([supplier, items]) => {
      items.forEach((order) => {
        rows.push([
          supplier,
          order.id,
          order.date,
          order.customer,
          order.product,
        ]);
      });
    });

    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map((value) => `"${String(value).replaceAll('"', '""')}"`)
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "SellerFlow_발주서.csv";
    link.click();

    URL.revokeObjectURL(url);

    alert(
      `${targetOrders.length}건을 ${Object.keys(grouped).length}개 도매처로 분류했습니다.`
    );
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>주문내역</h1>
          <p>
            주문을 선택하면 도매처별로 자동 분류해
            발주서를 생성합니다.
          </p>
        </div>

        <button
          onClick={createPurchaseOrder}
          style={{
            border: 0,
            background: "#7257ff",
            color: "white",
            padding: "11px 16px",
            borderRadius: "10px",
            fontWeight: "700",
          }}
        >
          발주서 생성 ({selected.length})
        </button>
      </div>

      <div className="panel">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "16px",
            fontSize: "13px",
          }}
        >
          <input
            type="checkbox"
            checked={
              selectableOrders.length > 0 &&
              selected.length === selectableOrders.length
            }
            onChange={toggleAll}
          />

          전체 선택

          <span style={{ color: "#929cad" }}>
            · 도매처가 연결된 주문만 발주 가능
          </span>
        </div>

        <div className="table">
          <table>
            <thead>
              <tr>
                <th>선택</th>
<th>주문번호</th>
<th>날짜</th>
<th>고객</th>
<th>상품</th>
<th>옵션</th>
<th>수량</th>
<th>판매금액</th>
<th>도매처</th>
<th>발주상태</th>
<th>운송장상태</th>
              </tr>
            </thead>

            <tbody>
              {orders.map((o) => {
                const canOrder =
                  o.supplier !== "미연결";

                return (
                  <tr key={o.id}>
                    <td>
                      <input
                        type="checkbox"
                        disabled={!canOrder}
                        checked={selected.includes(o.id)}
                        onChange={() => toggleOrder(o.id)}
                      />
                    </td>

                    <td>
                      <b>{o.id}</b>
                    </td>

                    <td>{o.date}</td>
<td>{o.customer}</td>
<td>{o.product}</td>
<td>{o.option}</td>
<td>{o.qty}</td>
<td>₩{o.saleAmount.toLocaleString()}</td>
<td>{o.supplier}</td>
<td>
  <span className="tag">
    {canOrder ? "발주 가능" : "도매처 연결 필요"}
  </span>
</td>
<td>
  <span className="tag">
    {o.invoiceStatus}
  </span>
</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function OrderTable({ rows }) {
  return (
    <div className="table">
      <table>
        <thead>
          <tr>
            <th>주문번호</th>
<th>날짜</th>
<th>고객</th>
<th>상품</th>
<th>옵션</th>
<th>수량</th>
<th>판매금액</th>
<th>도매처</th>
<th>발주상태</th>
<th>운송장상태</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td><b>{o.id}</b></td>
<td>{o.date}</td>
<td>{o.customer}</td>
<td>{o.product}</td>
<td>{o.option}</td>
<td>{o.qty}</td>
<td>₩{o.saleAmount.toLocaleString()}</td>
<td>{o.supplier}</td>

<td>
  <span className="tag">
    {o.purchaseStatus}
  </span>
</td>

<td>
  <span className="tag">
    {o.invoiceStatus}
  </span>
</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyPage({ title }) {
  return (
    <>
      <div className="head">
        <div>
          <h1>{title}</h1>
          <p>SellerFlow 자동화 관리</p>
        </div>
      </div>

      <div className="panel empty">
        <h2>{title}</h2>
        <p>
          다음 개발 단계에서 실제 기능을 연결합니다.
        </p>
      </div>
    </>
  );
}
function SupplierPage() {
  const [suppliers, setSuppliers] = useState([
  {
    id: 1,
    name: "A농장",
    contact: "010-1234-5678",
    method: "카카오톡",
    products: "사과 5kg",
    status: "사용중",
  },
  {
    id: 2,
    name: "C농장",
    contact: "010-5678-1234",
    method: "카카오톡",
    products: "복숭아 3kg",
    status: "사용중",
  },
]);

const [showForm, setShowForm] = useState(false);
const [editingId, setEditingId] = useState(null);
const [newSupplier, setNewSupplier] = useState({
  name: "",
  contact: "",
  method: "카카오톡",
  products: "",
});
const addSupplier = () => {
  if (!newSupplier.name.trim()) return;

  if (editingId !== null) {
    setSuppliers(
      suppliers.map((supplier) =>
        supplier.id === editingId
          ? {
              ...supplier,
              ...newSupplier,
            }
          : supplier
      )
    );

    setEditingId(null);
  } else {
    setSuppliers([
      ...suppliers,
      {
        id: Date.now(),
        ...newSupplier,
        status: "사용중",
      },
    ]);
  }

  setNewSupplier({
    name: "",
    contact: "",
    method: "카카오톡",
    products: "",
  });

  setShowForm(false);
};
  

const startEditSupplier = (supplier) => {
  setEditingId(supplier.id);

  setNewSupplier({
    name: supplier.name,
    contact: supplier.contact,
    method: supplier.method,
    products: supplier.products,
  });

  setShowForm(true);
  setTimeout(() => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}, 0);
};

const cancelSupplierForm = () => {
  setEditingId(null);

  setNewSupplier({
    name: "",
    contact: "",
    method: "카카오톡",
    products: "",
  });

  setShowForm(false);
}; 
   return (
  <>
      <div className="head">
        <div>
          <h1>도매처 관리</h1>
          <p>발주에 사용할 도매처를 등록하고 관리합니다.</p>
        </div>

        <button
  className="primary"
  onClick={() => {
  setEditingId(null);
  setNewSupplier({
    name: "",
    contact: "",
    method: "카카오톡",
    products: "",
  });
  setShowForm(true);
}}
>
  + 도매처 추가
</button>
      </div>
{showForm && (
  <div className="panel">
    <h2>{editingId !== null ? "도매처 수정" : "도매처 추가"}</h2>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "12px",
        marginTop: "16px",
      }}
    >
      <input
        placeholder="도매처명"
        value={newSupplier.name}
        onChange={(e) =>
          setNewSupplier({ ...newSupplier, name: e.target.value })
        }
      />

      <input
        placeholder="연락처"
        value={newSupplier.contact}
        onChange={(e) =>
          setNewSupplier({ ...newSupplier, contact: e.target.value })
        }
      />

      <select
        value={newSupplier.method}
        onChange={(e) =>
          setNewSupplier({ ...newSupplier, method: e.target.value })
        }
      >
        <option value="카카오톡">카카오톡</option>
        <option value="문자">문자</option>
        <option value="이메일">이메일</option>
        <option value="기타">기타</option>
      </select>

      <input
        placeholder="연결 상품"
        value={newSupplier.products}
        onChange={(e) =>
          setNewSupplier({ ...newSupplier, products: e.target.value })
        }
      />
    </div>

    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: "8px",
        marginTop: "16px",
      }}
    >
      <button
        className="secondary"
        onClick={cancelSupplierForm}
      >
        취소
      </button>

      <button
        className="primary"
        onClick={addSupplier}
      >
        {editingId !== null ? "저장" : "등록"}
      </button>
    </div>
  </div>
)}
      <div className="panel">
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>도매처</th>
                <th>연락처</th>
                <th>발주 방식</th>
                <th>연결 상품</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>

            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td><strong>{supplier.name}</strong></td>
                  <td>{supplier.contact}</td>
                  <td>{supplier.method}</td>
                  <td>{supplier.products}</td>
                  <td>
                    <span className="tag">{supplier.status}</span>
                  </td>
                  <td>
                    <button
  className="secondary"
  onClick={() => startEditSupplier(supplier)}
>
  수정
</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
