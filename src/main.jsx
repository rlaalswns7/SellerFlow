import React, { useEffect, useMemo, useState } from "react";
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
const [products, setProducts] = useState([
  {
    id: 1,
    name: "사과 5kg",
    option: "5kg / 특품",
    price: 32900,
    supplier: "A농장",
  },
  {
    id: 2,
    name: "토마토 2kg",
    option: "2kg",
    price: 21900,
    supplier: "",
  },
  {
    id: 3,
    name: "복숭아 3kg",
    option: "3kg",
    price: 28900,
    supplier: "C농장",
  },
]);
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
 <Dashboard setPage={setPage} /> 
) : page === "주문내역" ? (
  <OrderPage products={products} />
) : page === "도매처 관리" ? (
  <SupplierPage />
) : page === "상품 연결" ? (
   <ProductLinkPage
  products={products}
  setProducts={setProducts}
/>
) : page === "운송장 관리" ? (
  <InvoicePage />
) : page === "CS 관리" ? (
  <CSPage />
) : (
  <EmptyPage title={page} />
)}
        </section>
      </main>
    </div>
  );
}

function Dashboard({ setPage }) {
  const [range, setRange] = useState(7);

  const data = useMemo(
    () => sales30.slice(-range),
    [range]
  );
const urgentCsCount = useMemo(() => {
  const saved = localStorage.getItem("sellerflow_cs_inquiries");

  if (!saved) return 0;

  try {
    const inquiries = JSON.parse(saved);

    return inquiries.filter(
      (item) =>
        item.deadline === "오늘" &&
        item.status !== "답변완료"
    ).length;
  } catch {
    return 0;
  }
}, []);
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
  count={`${urgentCsCount}`}
  title="CS 마감 임박"
  description={
    urgentCsCount > 0
      ? "오늘까지 답변 필요"
      : "긴급 CS 없음"
  } 
  onClick={() => setPage("CS 관리")}
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
function StatusCard({ count, title, description, onClick }) {
  return (
    <div
  className="card"
  onClick={onClick}
  style={{ cursor: onClick ? "pointer" : "default" }}
>
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

function OrderPage({ products }) {
  const [selected, setSelected] = useState([]);
 const [orderList, setOrderList] = useState(orders);
 const matchedOrders = orderList.map((order) => { 
  const linkedProduct = products.find(
    (product) => product.name === order.product
  );

  return {
    ...order,
    supplier: linkedProduct?.supplier || "미연결",
  };
});
  const toggleOrder = (id) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const selectableOrders = matchedOrders.filter(
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
    const targetOrders = matchedOrders.filter((o) =>
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
setOrderList((prev) =>
  prev.map((order) =>
    selected.includes(order.id)
      ? {
          ...order,
          purchaseStatus: "발주완료",
          invoiceStatus: "송장대기",
        }
      : order
  )
);

setSelected([]);
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
              {matchedOrders.map((o) => {
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
    {o.supplier === "미연결" ? "도매처 연결 필요" : o.purchaseStatus}
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
 const deleteSupplier = (id) => {
  const ok = window.confirm("이 도매처를 삭제할까요?");
  if (!ok) return;

  setSuppliers(
    suppliers.filter((supplier) => supplier.id !== id)
  );
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
    <td>
      <strong>{supplier.name}</strong>
    </td>
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

      <button
        className="secondary"
        onClick={() => deleteSupplier(supplier.id)}
        style={{ marginLeft: "8px" }}
      >
        삭제
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
function ProductLinkPage({ products, setProducts }) {
 

  const supplierOptions = ["A농장", "C농장"];

  const changeSupplier = (id, supplier) => {
    setProducts(
      products.map((product) =>
        product.id === id
          ? { ...product, supplier }
          : product
      )
    );
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>상품 연결</h1>
          <p>판매 상품과 발주 도매처를 연결합니다.</p>
        </div>
      </div>

      <div className="panel">
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>상품</th>
                <th>옵션</th>
                <th>판매가</th>
                <th>도매처</th>
                <th>연결 상태</th>
              </tr>
            </thead>

            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <strong>{product.name}</strong>
                  </td>

                  <td>{product.option}</td>

                  <td>
                    ₩{product.price.toLocaleString()}
                  </td>

                  <td>
                    <select
                      value={product.supplier}
                      onChange={(e) =>
                        changeSupplier(product.id, e.target.value)
                      }
                    >
                      <option value="">도매처 선택</option>

                      {supplierOptions.map((supplier) => (
                        <option key={supplier} value={supplier}>
                          {supplier}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <span className="tag">
                      {product.supplier ? "연결완료" : "미연결"}
                    </span>
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
function CSPage() {
const [inquiries, setInquiries] = useState(() => {
  const saved = localStorage.getItem("sellerflow_cs_inquiries");

  if (saved) {
    try {
     return JSON.parse(saved); 
    } catch {
      // 저장값이 깨졌으면 기본값 사용
    }
  }

  return [
    {
      id: "Q10001",
      orderId: "C10001",
      product: "사과 5kg",
      customer: "홍길동",
      content: "상품은 언제 출고되나요?",
      deadline: "오늘",
      status: "답변대기",
      answer: "",
    },
    {
      id: "Q10002",
      orderId: "C10003",
      product: "복숭아 3kg",
      customer: "이서준",
      content: "배송지를 변경하고 싶어요.",
      deadline: "1일 남음",
      status: "확인필요",
      answer: "",
    },
  ];
});

useEffect(() => {
  localStorage.setItem(
    "sellerflow_cs_inquiries",
    JSON.stringify(inquiries)
  );
}, [inquiries]);

const replyInquiry = (id) => {
  const target = inquiries.find((item) => item.id === id);
  if (!target) return;

  if (target.status === "답변완료") {
    alert("이미 답변한 문의입니다.");
    return;
  }

  const answer = window.prompt(
    "고객에게 보낼 답변을 입력하세요.",
    target.answer || ""
  );

  if (answer === null) return;

  if (!answer.trim()) {
    alert("답변 내용을 입력해주세요.");
    return;
  }

  setInquiries((prev) =>
    prev.map((item) =>
      item.id === id
        ? {
            ...item,
            answer: answer.trim(),
            status: "답변완료",
          }
        : item
    )
  );
 addCsLog(
  "고객문의 답변",
  target,
  `답변완료 · ${answer.trim()}`
); 
};
const [returnCases, setReturnCases] = useState(() => {
  const saved = localStorage.getItem("sellerflow_cs_returns");

  if (saved) {
    try {
   return JSON.parse(saved).map((item) => ({
  ...item,
  evidence: item.evidence || "",
  evidenceImages: item.evidenceImages || [],
  supplierReply: item.supplierReply || "",
  reviewNote: item.reviewNote || "",
}));  
    } catch {
      // 저장값이 깨졌으면 기본값 사용
    }
  }

  return [
    {
      id: "R10001",
      orderId: "C10001",
      product: "사과 5kg",
      customer: "홍길동",
      reason: "단순변심",
      shipped: true,
      status: "처리대기",
      processed: false,
    },
    {
      id: "R10002",
      orderId: "C10003",
      product: "복숭아 3kg",
      customer: "이서준",
      reason: "품질문제",
      shipped: false,
      status: "수동검토",
      processed: false,
      evidence: "",
      evidenceImages: [],
      supplierReply: "",
reviewNote: "",
    },
  ];
});
const [selectedReturnCase, setSelectedReturnCase] = useState(null);
  useEffect(() => {
  localStorage.setItem(
    "sellerflow_cs_returns",
    JSON.stringify(returnCases)
  );
}, [returnCases]);
const [csLogs, setCsLogs] = useState(() => {
  const saved = localStorage.getItem("sellerflow_cs_logs");

  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // 저장값이 깨졌으면 빈 로그 사용
    }
  }

  return [];
});

useEffect(() => {
  localStorage.setItem(
    "sellerflow_cs_logs",
    JSON.stringify(csLogs)
  );
}, [csLogs]);

const addCsLog = (type, target, message) => {
  setCsLogs((prev) => [
    {
      id: `${Date.now()}-${prev.length}`,
      time: new Date().toLocaleString("ko-KR"),
      caseId: target.id,
      orderId: target.orderId,
      type,
      message,
    },
    ...prev,
  ]);
};
const handleReturnCase = (id) => {
  const target = returnCases.find((item) => item.id === id);
  if (!target) return;

  if (target.processed) {
    alert("이미 처리된 반품/취소 건입니다.");
    return;
  }

  if (target.reason !== "단순변심") {
  const supplier = getSupplierByOrderId(target.orderId);

  if (supplier === "미연결") {
    alert("도매처가 연결되지 않은 주문입니다. 먼저 도매처를 연결해주세요.");
    return;
  }

  const evidence = window.prompt(
    "불량/오배송 증빙 내용을 입력하세요.\n예: 사진 확인됨, 박스 파손, 상품 상태 등",
    target.evidence || ""
  );

  if (evidence === null) return;

  if (!evidence.trim()) {
    alert("증빙 내용을 입력해주세요.");
    return;
  }

  const reviewNote = window.prompt(
    "도매처에 전달할 검토 메모를 입력하세요.",
    target.reviewNote || ""
  );

  if (reviewNote === null) return;

  const action = window.prompt(
    `${supplier}에 확인할 처리 방법을 입력하세요.\n\n환불 또는 재배송`,
    target.resolution || "환불"
  );

  if (action === null) return;

  const normalizedAction = action.trim();

  if (
    normalizedAction !== "환불" &&
    normalizedAction !== "재배송"
  ) {
    alert("환불 또는 재배송 중 하나를 입력해주세요.");
    return;
  }

  setReturnCases((prev) =>
    prev.map((item) =>
      item.id === id
        ? {
            ...item,
            supplier,
            evidence: evidence.trim(),
            reviewNote: reviewNote.trim(),
            resolution: normalizedAction,
            status: `${supplier} 확인대기 · ${normalizedAction}`,
          }
        : item
    )
  );
addCsLog(
  "수동검토 시작",
  target,
  `${supplier} · ${normalizedAction} 요청 · 증빙 확인`
);
  alert(
    `${supplier} 확인 대상으로 분류했습니다.\n증빙 저장 완료\n처리 예정: ${normalizedAction}`
  );

  return;
}

  
  setReturnCases((prev) =>
    prev.map((item) =>
      item.id === id
        ? {
            ...item,
            status: item.shipped
              ? "회수없이 환불완료(테스트)"
              : "출고중지·환불완료(테스트)",
            processed: true,
          }
        : item
    )
  );
addCsLog(
  "자동처리 완료",
  target,
  target.shipped
    ? "단순변심 · 출고됨 · 회수 없이 환불 처리"
    : "단순변심 · 출고 전 · 출고중지 후 환불 처리"
);
  alert(
    target.shipped
      ? "이미 출고된 주문입니다. 회수 없이 환불 처리했습니다.(테스트)"
      : "출고를 중지하고 환불 처리했습니다.(테스트)"
  );
};
 const getSupplierByOrderId = (orderId) => {
  const matchedOrder = orders.find(
    (order) => order.id === orderId
  );

  return matchedOrder?.supplier || "미연결";
};
const completeManualCase = (id) => {
  const target = returnCases.find((item) => item.id === id);
  if (!target) return;

  if (target.processed) {
    alert("이미 최종 처리된 건입니다.");
    return;
  }

  if (!target.supplier || !target.resolution) {
    alert("먼저 수동검토에서 환불 또는 재배송을 선택해주세요.");
    return;
  }
  const supplierReply = window.prompt(
  `${target.supplier}에서 받은 회신 내용을 입력하세요.`,
  target.supplierReply || ""
);

if (supplierReply === null) return;

if (!supplierReply.trim()) {
  alert("도매처 회신 내용을 입력해주세요.");
  return;
}
  const confirmed = window.confirm(
    `${target.supplier} 회신을 확인했나요?\n\n${target.resolution} 완료 처리합니다.`
  );

  if (!confirmed) return;
addCsLog(
  "도매처 회신",
  target,
  `${target.supplier} · ${supplierReply.trim()}`
);
  setReturnCases((prev) =>
    prev.map((item) =>
      item.id === id
        ? {
            ...item,
            status: `${target.resolution}완료(테스트)`,
supplierReply: supplierReply.trim(),
processed: true,
          }
        : item
    )
  );
addCsLog(
  "처리 완료",
  target,
  `${target.supplier} · ${target.resolution} 완료`
);
  alert(`${target.resolution} 완료 처리했습니다.(테스트)`);
};
 const handleEvidenceImageUpload = (id, e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("이미지 파일만 첨부할 수 있습니다.");
    return;
  }

  if (file.size > 1500 * 1024) {
    alert("사진은 1.5MB 이하만 첨부할 수 있습니다.");
    return;
  }

  const target = returnCases.find((item) => item.id === id);
  if (!target) return;

  if ((target.evidenceImages || []).length >= 3) {
    alert("증빙 사진은 최대 3장까지 첨부할 수 있습니다.");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    setReturnCases((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              evidenceImages: [
                ...(item.evidenceImages || []),
                reader.result,
              ],
            }
          : item
      )
    );
  };

  reader.readAsDataURL(file);
  e.target.value = "";
};

const removeEvidenceImage = (id, index) => {
  setReturnCases((prev) =>
    prev.map((item) =>
      item.id === id
        ? {
            ...item,
            evidenceImages: (item.evidenceImages || []).filter(
              (_, i) => i !== index
            ),
          }
        : item
    )
  );
};
const selectedCase =
  returnCases.find((item) => item.id === selectedReturnCase) || null;
 const pendingInquiryCount = inquiries.filter(
  (item) => item.status !== "답변완료"
).length;

const manualReviewCount = returnCases.filter(
  (item) => !item.processed && item.reason !== "단순변심"
).length;

const completedCsCount =
  inquiries.filter((item) => item.status === "답변완료").length +
  returnCases.filter((item) => item.processed).length;
const urgentInquiryCount = inquiries.filter(
  (item) =>
    item.deadline === "오늘" &&
    item.status !== "답변완료"
).length;
  const getDeadlinePriority = (deadline) => {
  if (deadline === "오늘") return 0;

  const match = deadline?.match(/(\d+)일/);
  if (match) return Number(match[1]);

  return 999;
};

const sortedInquiries = [...inquiries].sort(
  (a, b) =>
    getDeadlinePriority(a.deadline) -
    getDeadlinePriority(b.deadline)
);
  return (
    <>
      <div className="head">
        <div>
          <h1>CS 관리</h1>
          <p>고객문의와 반품·취소 요청을 한 곳에서 관리합니다.</p>
        </div>
      </div>
<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
    marginBottom: "20px",
  }}
>
  <div className="panel">
    <h2>답변 대기</h2>
    <h1>{pendingInquiryCount}건</h1>
    <p>
  아직 답변하지 않은 고객문의입니다.
  {urgentInquiryCount > 0 && (
    <span
      style={{
        marginLeft: "8px",
        color: "#dc2626",
        fontWeight: "700",
      }}
    >
      마감 임박 {urgentInquiryCount}건
    </span>
  )}
</p>
  </div>

  <div className="panel">
    <h2>수동 검토</h2>
    <h1>{manualReviewCount}건</h1>
    <p>확인이 필요한 반품·취소 요청입니다.</p>
  </div>

  <div className="panel">
    <h2>처리 완료</h2>
    <h1>{completedCsCount}건</h1>
    <p>답변 또는 CS 처리가 완료된 건입니다.</p>
  </div>
</div>
     
      <div className="panel" style={{ marginBottom: "20px" }}>
        <div className="head">
          <div>
            <h2>고객문의</h2>
            <p>총 {inquiries.length}건</p>
          </div>
        </div>

        <div className="table">
          <table>
            <thead>
              <tr>
                <th>문의번호</th>
                <th>주문번호</th>
                <th>상품</th>
                <th>고객</th>
                <th>문의내용</th>
                <th>마감</th>
                <th>상태</th>
                <th>작업</th>
              </tr>
            </thead>

            <tbody>
              {sortedInquiries.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.id}</strong>
                  </td>
                  <td>{item.orderId}</td>
                  <td>{item.product}</td>
                  <td>{item.customer}</td>
                  <td>{item.content}</td>
                  <td>
  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
    <span>{item.deadline}</span>

    {item.deadline === "오늘" &&
  item.status !== "답변완료" && (
      <span
        className="tag"
        style={{
          background: "#fee2e2",
          color: "#dc2626",
        }}
      >
        마감 임박
      </span>
    )}
  </div>
</td>
                  <td>
                    <span className="tag">{item.status}</span>
                  </td>
                  <td>
                    <button
  className="secondary"
  onClick={() => replyInquiry(item.id)}
  disabled={item.status === "답변완료"}
>
  {item.status === "답변완료" ? "답변완료" : "답변"}
</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="head">
          <div>
            <h2>반품 / 취소</h2>
            <p>총 {returnCases.length}건</p>
          </div>
        </div>

        <div className="table">
          <table>
            <thead>
              <tr>
                <th>접수번호</th>
                <th>주문번호</th>
                <th>상품</th>
                <th>고객</th>
                <th>사유</th>
                <th>도매처</th>
              <th>증빙</th>
                <th>출고상태</th>
                <th>처리상태</th>
                <th>작업</th>
              </tr>
            </thead>

            <tbody>
              {returnCases.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.id}</strong>
                  </td>
                  <td>{item.orderId}</td>
                  <td>{item.product}</td>
                  <td>{item.customer}</td>
                  <td>{item.reason}</td>
                 <td>{getSupplierByOrderId(item.orderId)}</td>
                <td>
  {item.reason === "단순변심" ? (
    "-"
  ) : (
    <div>
     <label
  style={{
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 12px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    background: "#f3f4f6",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    whiteSpace: "nowrap",
  }}
> 
        사진 추가
        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            handleEvidenceImageUpload(item.id, e)
          }
          style={{ display: "none" }}
        />
      </label>

      <div
        style={{
          display: "flex",
          gap: "6px",
          marginTop: "8px",
          flexWrap: "wrap",
        }}
      >
        {(item.evidenceImages || []).map((image, index) => (
          <div key={index}>
            <img
              src={image}
              alt={`증빙 ${index + 1}`}
              style={{
                width: "55px",
                height: "55px",
                objectFit: "cover",
                borderRadius: "8px",
              }}
            />

            <button
              className="secondary"
              onClick={() =>
                removeEvidenceImage(item.id, index)
              }
              style={{
                display: "block",
                marginTop: "3px",
                fontSize: "11px",
              }}
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  )}
</td>
                  <td>{item.shipped ? "출고됨" : "출고 전"}</td>
                  <td>
                    <span className="tag">{item.status}</span>
                  </td>
                  <td>
                   <button
  className="secondary"
  onClick={() =>
    item.reason === "단순변심"
      ? handleReturnCase(item.id)
      : item.supplier && item.resolution
      ? completeManualCase(item.id)
      : handleReturnCase(item.id)
  }
  disabled={item.processed}
>
  {item.processed
    ? "처리완료"
    : item.reason === "단순변심"
    ? "자동처리"
    : item.supplier && item.resolution
    ? `${item.resolution} 완료처리`
    : "수동검토"}
</button>
                <button
  className="secondary"
  onClick={() => setSelectedReturnCase(item.id)}
  style={{ marginLeft: "6px" }}
>
  상세보기
</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
 {selectedCase && (
  <div className="panel" style={{ marginTop: "20px" }}>
    <div className="head">
      <div>
        <h2>CS 상세보기</h2>
        <p>
          {selectedCase.id} · {selectedCase.orderId}
        </p>
      </div>

      <button
        className="secondary"
        onClick={() => setSelectedReturnCase(null)}
      >
        닫기
      </button>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "16px",
      }}
    >
      <div>
        <strong>상품</strong>
        <p>{selectedCase.product}</p>
      </div>

      <div>
        <strong>고객</strong>
        <p>{selectedCase.customer}</p>
      </div>

      <div>
        <strong>사유</strong>
        <p>{selectedCase.reason}</p>
      </div>

      <div>
        <strong>도매처</strong>
        <p>
          {selectedCase.supplier ||
            getSupplierByOrderId(selectedCase.orderId)}
        </p>
      </div>

      <div>
        <strong>출고상태</strong>
        <p>{selectedCase.shipped ? "출고됨" : "출고 전"}</p>
      </div>

      <div>
        <strong>처리상태</strong>
        <p>
          <span className="tag">
            {selectedCase.status}
          </span>
        </p>
      </div>
    </div>

    <div style={{ marginTop: "20px" }}>
      <strong>증빙 내용</strong>
      <p>{selectedCase.evidence || "등록된 증빙 내용이 없습니다."}</p>
    </div>

    <div style={{ marginTop: "20px" }}>
      <strong>증빙 사진</strong>

      {(selectedCase.evidenceImages || []).length === 0 ? (
        <p>첨부된 사진이 없습니다.</p>
      ) : (
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            marginTop: "10px",
          }}
        >
          {(selectedCase.evidenceImages || []).map(
            (image, index) => (
              <img
                key={index}
                src={image}
                alt={`증빙 ${index + 1}`}
                style={{
                  width: "110px",
                  height: "110px",
                  objectFit: "cover",
                  borderRadius: "12px",
                }}
              />
            )
          )}
        </div>
      )}
    </div>

    <div style={{ marginTop: "20px" }}>
      <strong>검토 메모</strong>
      <p>
        {selectedCase.reviewNote ||
          "등록된 검토 메모가 없습니다."}
      </p>
    </div>

    <div style={{ marginTop: "20px" }}>
      <strong>도매처 회신</strong>
      <p>
        {selectedCase.supplierReply ||
          "아직 도매처 회신이 없습니다."}
      </p>
    </div>

    <div style={{ marginTop: "20px" }}>
      <strong>처리 결과</strong>
      <p>{selectedCase.resolution || "아직 결정되지 않음"}</p>
    </div>
  </div>
)}
<div className="panel" style={{ marginTop: "20px" }}>
  <div className="head">
    <div>
      <h2>CS 처리 로그</h2>
      <p>반품·취소 처리 내역을 확인합니다.</p>
    </div>

    <button
      className="secondary"
      onClick={() => {
        if (window.confirm("CS 처리 로그를 모두 삭제할까요?")) {
          setCsLogs([]);
        }
      }}
      disabled={csLogs.length === 0}
    >
      로그 비우기
    </button>
  </div>

  <div className="table">
    <table>
      <thead>
        <tr>
          <th>시간</th>
          <th>접수번호</th>
          <th>주문번호</th>
          <th>처리유형</th>
          <th>내용</th>
        </tr>
      </thead>

      <tbody>
        {csLogs.length === 0 ? (
          <tr>
            <td colSpan="5">아직 CS 처리 기록이 없습니다.</td>
          </tr>
        ) : (
          csLogs.map((log) => (
            <tr key={log.id}>
              <td>{log.time}</td>
              <td><strong>{log.caseId}</strong></td>
              <td>{log.orderId}</td>
              <td>
                <span className="tag">{log.type}</span>
              </td>
              <td>{log.message}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
</div>
    </>
  );
}
function InvoicePage() {
 const [invoiceRows, setInvoiceRows] = useState(() => {
  const saved = localStorage.getItem("sellerflow_invoices");

  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // 저장 데이터가 깨졌으면 기본값 사용
    }
  }

  return orders
    .filter((order) => order.supplier !== "미연결")
    .map((order) => ({
      id: order.id,
      product: order.product,
      supplier: order.supplier,
      carrier: "",
      invoice: "",
      status: "송장대기",
    }));
});

useEffect(() => {
  localStorage.setItem(
    "sellerflow_invoices",
    JSON.stringify(invoiceRows)
  );
}, [invoiceRows]); 
  const [selectedInvoices, setSelectedInvoices] = useState([]);
 const [invoiceLogs, setInvoiceLogs] = useState(() => {
  const saved = localStorage.getItem("sellerflow_invoice_logs");

  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  }

  return [];
});

useEffect(() => {
  localStorage.setItem(
    "sellerflow_invoice_logs",
    JSON.stringify(invoiceLogs)
  );
}, [invoiceLogs]);

const addInvoiceLog = (type, row, message) => {
  setInvoiceLogs((prev) =>
    [
      {
        id: `${Date.now()}-${row.id}`,
        time: new Date().toLocaleString("ko-KR"),
        orderId: row.id,
        type,
        message,
      },
      ...prev,
    ].slice(0, 100)
  );
};
  const toggleInvoice = (id) => {
  setSelectedInvoices((prev) =>
    prev.includes(id)
      ? prev.filter((x) => x !== id)
      : [...prev, id]
  );
};

const selectableInvoices = invoiceRows.filter(
  (row) => row.carrier && row.invoice
    );
    const toggleAllInvoices = () => {
  if (selectedInvoices.length === selectableInvoices.length) {
    setSelectedInvoices([]);
  } else {
    setSelectedInvoices(selectableInvoices.map((row) => row.id));
  }
};

const registerSelectedInvoices = () => {
  const selectedRows = invoiceRows.filter((row) =>
    selectedInvoices.includes(row.id)
  );

  if (selectedRows.length === 0) {
    alert("등록할 송장을 선택해주세요.");
    return;
  }

  const registerTargets = selectedRows.filter(
    (row) =>
      row.carrier &&
      row.invoice &&
      row.status !== "등록완료(테스트)"
  );

  const duplicateTargets = selectedRows.filter(
    (row) => row.status === "등록완료(테스트)"
  );

  if (registerTargets.length === 0) {
    duplicateTargets.forEach((row) => {
      addInvoiceLog(
        "중복등록 차단",
        row,
        "이미 등록된 송장이어서 일괄등록에서 제외했습니다."
      );
    });

    alert("새로 등록할 송장이 없습니다.");
    setSelectedInvoices([]);
    return;
  }

  setInvoiceRows((prev) =>
    prev.map((row) =>
      registerTargets.some((target) => target.id === row.id)
        ? {
            ...row,
            status: "등록완료(테스트)",
          }
        : row
    )
  );

  registerTargets.forEach((row) => {
    addInvoiceLog(
      "일괄 등록 완료",
      row,
      `${row.carrier} / ${row.invoice} 일괄등록 완료(테스트)`
    );
  });

  duplicateTargets.forEach((row) => {
    addInvoiceLog(
      "중복등록 차단",
      row,
      "이미 등록된 송장이어서 일괄등록에서 제외했습니다."
    );
  });

  alert(
    `${registerTargets.length}건 등록 완료 / ${duplicateTargets.length}건 중복 제외`
  );

  setSelectedInvoices([]);
};
 const cancelSelectedInvoices = () => {
  const selectedRows = invoiceRows.filter((row) =>
    selectedInvoices.includes(row.id)
  );

  if (selectedRows.length === 0) {
    alert("등록 취소할 송장을 선택해주세요.");
    return;
  }

  const cancelTargets = selectedRows.filter(
    (row) => row.status === "등록완료(테스트)"
  );

  const excludedTargets = selectedRows.filter(
    (row) => row.status !== "등록완료(테스트)"
  );

  if (cancelTargets.length === 0) {
    excludedTargets.forEach((row) => {
      addInvoiceLog(
        "취소 제외",
        row,
        "등록 완료 상태가 아니어서 일괄취소에서 제외했습니다."
      );
    });

    alert("취소할 수 있는 등록완료 송장이 없습니다.");
    setSelectedInvoices([]);
    return;
  }

  setInvoiceRows((prev) =>
    prev.map((row) =>
      cancelTargets.some((target) => target.id === row.id)
        ? {
            ...row,
            status: row.invoice ? "등록대기" : "송장대기",
          }
        : row
    )
  );

  cancelTargets.forEach((row) => {
    addInvoiceLog(
      "일괄 등록 취소",
      row,
      `${row.carrier} / ${row.invoice} 일괄 등록 취소(테스트)`
    );
  });

  excludedTargets.forEach((row) => {
    addInvoiceLog(
      "취소 제외",
      row,
      "등록 완료 상태가 아니어서 일괄취소에서 제외했습니다."
    );
  });

  alert(
    `${cancelTargets.length}건 취소 완료 / ${excludedTargets.length}건 제외`
  );

  setSelectedInvoices([]);
};
  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result || "").replace(/^\uFEFF/, "");

      const lines = text
        .split(/\r?\n/)
        .filter((line) => line.trim());

      if (lines.length < 2) {
        alert("송장 CSV에 데이터가 없습니다.");
        return;
      }

      const uploaded = lines
        .slice(1)
        .map((line) => {
          const columns = line
            .split(",")
            .map((value) =>
              value.trim().replace(/^"|"$/g, "")
            );

          return {
            id: columns[0],
            carrier: columns[1],
            invoice: columns[2],
          };
        })
        .filter((row) => row.id);

      setInvoiceRows((prev) =>
        prev.map((row) => {
          const matched = uploaded.find(
            (item) => item.id === row.id
          );

          if (!matched) return row;

          return {
            ...row,
            carrier: matched.carrier || "",
            invoice: matched.invoice || "",
            status: matched.invoice ? "등록대기" : "송장대기",
          };
        })
      );

      alert(`${uploaded.length}건의 송장 데이터를 불러왔습니다.`);
    };

    reader.readAsText(file, "UTF-8");
  };
  const registerInvoice = (id) => {
  const target = invoiceRows.find((row) => row.id === id);
  if (!target) return;

  if (target.status === "등록완료(테스트)") {
    alert("이미 등록된 송장입니다.");
    addInvoiceLog(
      "중복등록 차단",
      target,
      "이미 등록된 송장의 중복 등록을 차단했습니다."
    );
    return;
  }

  if (!target.carrier || !target.invoice) {
    alert("택배사와 운송장번호가 필요합니다.");
    addInvoiceLog(
      "등록 실패",
      target,
      "택배사 또는 운송장번호가 없습니다."
    );
    return;
  }

  setInvoiceRows((prev) =>
    prev.map((row) =>
      row.id === id
        ? {
            ...row,
            status: "등록완료(테스트)",
          }
        : row
    )
  );

  addInvoiceLog(
    "등록 완료",
    target,
    `${target.carrier} / ${target.invoice} 등록 완료(테스트)`
  );
};
const cancelInvoice = (id) => {
  const target = invoiceRows.find((row) => row.id === id);
  if (!target) return;

  if (target.status !== "등록완료(테스트)") {
    alert("등록 완료된 송장만 취소할 수 있습니다.");

    addInvoiceLog(
      "취소 실패",
      target,
      "등록 완료 상태가 아니어서 취소하지 않았습니다."
    );
    return;
  }

  setInvoiceRows((prev) =>
    prev.map((row) =>
      row.id === id
        ? {
            ...row,
            status: row.invoice ? "등록대기" : "송장대기",
          }
        : row
    )
  );

  addInvoiceLog(
    "등록 취소",
    target,
    `${target.carrier} / ${target.invoice} 등록 취소(테스트)`
  );
};
const editInvoice = (id) => {
  const target = invoiceRows.find((row) => row.id === id);
  if (!target) return;

  if (target.status === "등록완료(테스트)") {
    alert("먼저 등록 취소를 해주세요.");
    return;
  }

  const carrier = window.prompt("택배사를 입력하세요.", target.carrier);
  if (carrier === null) return;

  const invoice = window.prompt(
    "운송장번호를 입력하세요.",
    target.invoice
  );
  if (invoice === null) return;

  if (!carrier.trim() || !invoice.trim()) {
    alert("택배사와 운송장번호를 모두 입력해주세요.");
    return;
  }

  setInvoiceRows((prev) =>
    prev.map((row) =>
      row.id === id
        ? {
            ...row,
            carrier: carrier.trim(),
            invoice: invoice.trim(),
            status: "등록대기",
          }
        : row
    )
  );
};
  return (
    <>
      <div className="head">
        <div>
          <h1>운송장 관리</h1>
          <p>도매처에서 받은 송장 데이터를 주문번호와 자동 매칭합니다.</p>
        </div>
        <button
  className="primary"
  onClick={registerSelectedInvoices}
  disabled={selectedInvoices.length === 0}
>
  선택 송장 일괄등록 ({selectedInvoices.length})
</button> 
        <button
  className="secondary"
  onClick={cancelSelectedInvoices}
  disabled={selectedInvoices.length === 0}
>
  선택 등록취소 ({selectedInvoices.length})
</button>
        <label className="primary">
          송장 CSV 불러오기
          <input
            type="file"
            accept=".csv"
            onChange={handleCsvUpload}
            style={{ display: "none" }}
          />
        </label>
      </div>

      <div className="panel">
        <p style={{ marginBottom: "16px" }}>
          CSV 형식: 주문번호, 택배사, 운송장번호
        </p>

        <div className="table">
          <table>
            <thead>
              <tr>
              <th>
  <input
    type="checkbox"
    checked={
      selectableInvoices.length > 0 &&
      selectedInvoices.length === selectableInvoices.length
    }
    onChange={toggleAllInvoices}
  />
</th>
                <th>주문번호</th>
                <th>상품</th>
                <th>도매처</th>
                <th>택배사</th>
                <th>운송장번호</th>
                <th>상태</th>
             <th>관리</th>
              </tr>
            </thead>

            <tbody>
              {invoiceRows.map((row) => (
                <tr key={row.id}>
                 <td>
  <input
    type="checkbox"
    disabled={!row.carrier || !row.invoice}
    checked={selectedInvoices.includes(row.id)}
    onChange={() => toggleInvoice(row.id)}
  />
</td>
                  <td>
                    <strong>{row.id}</strong>
                  </td>
                  <td>{row.product}</td>
                  <td>{row.supplier}</td>
                  <td>{row.carrier || "-"}</td>
                  <td>{row.invoice || "-"}</td>
                  <td>
                    <span className="tag">
                      {row.status}
                    </span>
                  </td>
           <td>
  {row.status === "등록완료(테스트)" ? (
    <button
      className="secondary"
      onClick={() => cancelInvoice(row.id)}
    >
      등록 취소
    </button>
  ) : (
    <button
      className="secondary"
      onClick={() => registerInvoice(row.id)}
      disabled={!row.carrier || !row.invoice}
    >
      쿠팡 등록
    </button>
  )}

  <button
    className="secondary"
    onClick={() => editInvoice(row.id)}
    disabled={row.status === "등록완료(테스트)"}
    style={{ marginLeft: "8px" }}
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
   <div className="panel" style={{ marginTop: "20px" }}>
  <div className="head">
    <div>
      <h2>운송장 처리 로그</h2>
      <p>송장 등록, 취소, 실패 기록을 확인합니다.</p>
    </div>

    <button
      className="secondary"
      onClick={() => setInvoiceLogs([])}
      disabled={invoiceLogs.length === 0}
    >
      로그 비우기
    </button>
  </div>

  <div className="table">
    <table>
      <thead>
        <tr>
          <th>시간</th>
          <th>주문번호</th>
          <th>처리</th>
          <th>내용</th>
        </tr>
      </thead>

      <tbody>
        {invoiceLogs.length === 0 ? (
          <tr>
            <td colSpan="4">아직 처리 기록이 없습니다.</td>
          </tr>
        ) : (
          invoiceLogs.map((log) => (
            <tr key={log.id}>
              <td>{log.time}</td>
              <td>
                <strong>{log.orderId}</strong>
              </td>
              <td>
                <span className="tag">{log.type}</span>
              </td>
              <td>{log.message}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
</div>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
