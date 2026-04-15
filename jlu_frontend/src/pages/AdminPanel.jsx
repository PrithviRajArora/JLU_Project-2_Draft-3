import { useEffect, useState, useCallback } from 'react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import { students as studentsApi, faculty as facultyApi, courses as coursesApi, org, iaComponents, enrolments as enrolmentsApi } from '../api'

// ── tiny shared hook ──────────────────────────────────────────
// fetcher must be stable (defined outside render or wrapped in useCallback by caller)
function useList(fetcher) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFetcher = useCallback(fetcher, [])
  const reload = useCallback(() => {
    setLoading(true)
    stableFetcher().then(r => setData(r.data.results ?? r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [stableFetcher])
  useEffect(() => { reload() }, [reload])
  return { data, loading, reload }
}

// ══ Main Admin Panel ══════════════════════════════════════════
export default function AdminPanel() {
  const { user } = useAuth()
  const toast    = useToast()
  const [tab, setTab] = useState('students')

  if (user?.role !== 'admin') return (
    <div className="alert alert-error">Admin access only.</div>
  )

  const TABS = [
    ['students', '◉ Students'],
    ['faculty',  '◈ Faculty'],
    ['courses',  '▣ Courses'],
    ['orgs',     '⊞ Organisations'],
  ]

  return (
    <>
      <div className="page-header">
        <div className="page-title">Admin Panel</div>
        <div className="page-desc">Create and manage students, faculty, and courses</div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            color: tab === key ? 'var(--accent)' : 'var(--text3)',
            fontFamily: 'var(--font)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            borderBottom: `2px solid ${tab === key ? 'var(--accent)' : 'transparent'}`,
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'students' && <StudentsPanel toast={toast} />}
      {tab === 'faculty'  && <FacultyPanel  toast={toast} />}
      {tab === 'courses'  && <CoursesPanel  toast={toast} />}
      {tab === 'orgs'     && <OrgsPanel     toast={toast} />}
    </>
  )
}

// ══ STUDENTS PANEL ════════════════════════════════════════════
function StudentsPanel({ toast }) {
  const { data: programs } = useList(() => org.programs({ page_size: 200 }))
  const [modal, setModal]  = useState(false)
  const [search, setSearch] = useState('')
  const [list, setList]    = useState([])
  const [total, setTotal]  = useState(0)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback((q = search) => {
    setLoading(true)
    studentsApi.list({ search: q, page_size: 50 })
      .then(r => { setList(r.data.results ?? r.data); setTotal(r.data.count ?? 0) })
      .catch(() => toast.error('Failed to load students.'))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => { load() }, [])

  // Debounced live search — auto-searches as you type
  useEffect(() => {
    const timer = setTimeout(() => load(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  async function handleDelete(id, name) {
    if (!window.confirm(`Remove student "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await studentsApi.delete(id)
      toast.success(`✓ Student removed.`)
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <input className="form-input" style={{ maxWidth: 300 }}
          placeholder="Search by name, roll no, JLU ID…"
          value={search}
          onChange={e => setSearch(e.target.value)} />
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-primary" onClick={() => setModal(true)}>+ Add Student</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading
          ? <div className="loading" style={{ padding: 40 }}><div className="spinner" /></div>
          : list.length === 0
            ? <div className="empty-state"><div className="icon">◉</div><p>No students found.</p></div>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>Student ID</th><th>Roll No</th><th>Name</th>
                    <th>Program</th><th>Sem</th><th>Year</th><th></th>
                  </tr></thead>
                  <tbody>
                    {list.map(s => (
                      <tr key={s.student_id}>
                        <td><span className="text-mono" style={{ color: 'var(--accent)' }}>{s.student_id}</span></td>
                        <td><span className="text-mono">{s.roll_no}</span></td>
                        <td>{s.user_info?.first_name} {s.user_info?.last_name}</td>
                        <td style={{ fontSize: 12 }}>{s.program_name}</td>
                        <td>Sem {s.semester}</td>
                        <td className="text-muted">{s.academic_year}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-ghost btn-sm"
                              onClick={() => window.open(`/students/${s.student_id}`, '_blank')}>
                              View Report
                            </button>
                            <button className="btn btn-danger btn-sm"
                              disabled={deleting === s.student_id}
                              onClick={() => handleDelete(s.student_id, `${s.user_info?.first_name} ${s.user_info?.last_name}`)}>
                              {deleting === s.student_id ? '…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {total > list.length && (
                  <div style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 12 }}>
                    Showing {list.length} of {total}. Refine your search to find more.
                  </div>
                )}
              </div>
            )
        }
      </div>

      {modal && (
        <AddStudentModal
          programs={programs}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); load() }}
          toast={toast}
        />
      )}
    </div>
  )
}

function AddStudentModal({ programs, onClose, onSaved, toast }) {
  const [form, setForm] = useState({
    student_id: '', jlu_id: '', email: '', password: '', first_name: '', last_name: '',
    roll_no: '', gender: 'Male', program: '', semester: '1', section: '', academic_year: '',
  })
  const [saving, setSaving] = useState(false)
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  // Auto-generate IDs
  useEffect(() => {
    studentsApi.nextId().then(r => {
      setForm(p => ({
        ...p,
        student_id: p.student_id || r.data.student_id,
        jlu_id:     p.jlu_id     || r.data.jlu_id,
      }))
    }).catch(() => {})
  }, [])

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await studentsApi.create({
        ...form,
        program:  parseInt(form.program),
        semester: parseInt(form.semester),
      })
      toast.success(`✓ Student ${form.first_name} ${form.last_name} created.`)
      onSaved()
    } catch (err) {
      const data = err.response?.data
      const msg  = data?.message || data?.errors
        ? Object.entries(data.errors || {}).map(([k,v]) => `${k}: ${v}`).join(' · ')
        : 'Failed to create student.'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add New Student" onClose={onClose} width={560}>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Student ID"   value={form.student_id}   onChange={f('student_id')}   placeholder="e.g. S005" required />
          <FormField label="JLU ID"       value={form.jlu_id}       onChange={f('jlu_id')}        placeholder="e.g. STU005" required />
          <FormField label="First Name"   value={form.first_name}   onChange={f('first_name')}    required />
          <FormField label="Last Name"    value={form.last_name}    onChange={f('last_name')}     required />
          <FormField label="Email"        value={form.email}        onChange={f('email')}         type="email" required />
          <FormField label="Password"     value={form.password}     onChange={f('password')}      type="password" placeholder="Min 8 chars" required />
          <FormField label="Roll No"      value={form.roll_no}      onChange={f('roll_no')}       placeholder="e.g. 21BTCSE005" required />
          <div className="form-group">
            <label className="form-label">Gender *</label>
            <select className="form-select" value={form.gender} onChange={f('gender')} required>
              {['Male','Female','Other'].map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Program *</label>
            <select className="form-select" value={form.program} onChange={f('program')} required>
              <option value="">Select program…</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.short_name} — {p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Semester *</label>
            <select className="form-select" value={form.semester} onChange={f('semester')} required>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(s => <option key={s} value={s}>Sem {s}</option>)}
            </select>
          </div>
          <FormField label="Section"       value={form.section}       onChange={f('section')}       placeholder="e.g. A" />
          <FormField label="Academic Year" value={form.academic_year} onChange={f('academic_year')} placeholder="e.g. 2023-2024" required />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="spinner" style={{ width:14,height:14 }}/> Creating…</> : 'Create Student'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ══ FACULTY PANEL ═════════════════════════════════════════════
function FacultyPanel({ toast }) {
  const { data: schools } = useList(() => org.schools({ page_size: 100 }))
  const { data: list, loading, reload } = useList(() => facultyApi.list({ page_size: 200 }))
  const [modal, setModal]   = useState(false)
  const [deleting, setDel]  = useState(null)

  async function handleDelete(id, name) {
    if (!window.confirm(`Remove faculty "${name}"? This cannot be undone.`)) return
    setDel(id)
    try {
      await facultyApi.delete(id)
      toast.success('✓ Faculty removed.')
      reload()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed.')
    } finally {
      setDel(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Add Faculty</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading
          ? <div className="loading" style={{ padding: 40 }}><div className="spinner" /></div>
          : list.length === 0
            ? <div className="empty-state"><div className="icon">◈</div><p>No faculty yet.</p></div>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Faculty ID</th><th>Name</th><th>School</th><th>Department</th><th>JLU ID</th><th></th></tr></thead>
                  <tbody>
                    {list.map(f => (
                      <tr key={f.faculty_id}>
                        <td><span className="text-mono" style={{ color: 'var(--accent)' }}>{f.faculty_id}</span></td>
                        <td>{f.name}</td>
                        <td style={{ fontSize: 12 }}>{f.school_name}</td>
                        <td style={{ fontSize: 12 }}>{f.department ?? '—'}</td>
                        <td><span className="text-mono" style={{ fontSize: 12 }}>{f.user_info?.jlu_id}</span></td>
                        <td>
                          <button className="btn btn-danger btn-sm"
                            disabled={deleting === f.faculty_id}
                            onClick={() => handleDelete(f.faculty_id, f.name)}>
                            {deleting === f.faculty_id ? '…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>

      {modal && (
        <AddFacultyModal
          schools={schools}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); reload() }}
          toast={toast}
        />
      )}
    </div>
  )
}

function AddFacultyModal({ schools, onClose, onSaved, toast }) {
  const [form, setForm] = useState({
    faculty_id: '', jlu_id: '', email: '', password: '', first_name: '', last_name: '',
    name: '', school: '', department: '',
  })
  const [saving, setSaving] = useState(false)
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await facultyApi.create({ ...form, school: parseInt(form.school) })
      toast.success(`✓ Faculty ${form.name} created.`)
      onSaved()
    } catch (err) {
      const data = err.response?.data
      const msg  = data?.errors
        ? Object.entries(data.errors).map(([k,v]) => `${k}: ${v}`).join(' · ')
        : data?.message || 'Failed to create faculty.'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add New Faculty" onClose={onClose} width={520}>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Faculty ID"  value={form.faculty_id} onChange={f('faculty_id')} placeholder="e.g. F002" required />
          <FormField label="JLU ID"      value={form.jlu_id}     onChange={f('jlu_id')}     placeholder="e.g. FAC002" required />
          <FormField label="First Name"  value={form.first_name} onChange={f('first_name')} required />
          <FormField label="Last Name"   value={form.last_name}  onChange={f('last_name')}  required />
          <FormField label="Email"       value={form.email}      onChange={f('email')}       type="email" required />
          <FormField label="Password"    value={form.password}   onChange={f('password')}    type="password" placeholder="Min 8 chars" required />
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Display Name *</label>
            <input className="form-input" value={form.name} onChange={f('name')}
              placeholder="e.g. Prof. Ramesh Sharma" required />
          </div>
          <div className="form-group">
            <label className="form-label">School *</label>
            <select className="form-select" value={form.school} onChange={f('school')} required>
              <option value="">Select school…</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.short_name ?? s.name}</option>)}
            </select>
          </div>
          <FormField label="Department" value={form.department} onChange={f('department')} placeholder="e.g. Computer Science" />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="spinner" style={{ width:14,height:14 }}/> Creating…</> : 'Create Faculty'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ══ COURSES PANEL ════════════════════════════════════════════
function CoursesPanel({ toast }) {
  const { data: programs } = useList(() => org.programs({ page_size: 200 }))
  const { data: facultyList } = useList(() => facultyApi.list({ page_size: 200 }))
  const { data: list, loading, reload } = useList(() => coursesApi.list({ page_size: 200 }))
  const [modal, setModal]     = useState(false)
  const [compModal, setCompModal] = useState(null)  // course_code for adding components
  const [deleting, setDel]    = useState(null)
  const [search, setSearch]   = useState('')

  async function handleDelete(code, name) {
    if (!window.confirm(`Delete course "${name}" (${code})? This will remove all marks and components.`)) return
    setDel(code)
    try {
      await coursesApi.delete(code)
      toast.success(`✓ Course ${code} deleted.`)
      reload()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed.')
    } finally {
      setDel(null)
    }
  }

  const filtered = list.filter(c =>
    c.course_code.toLowerCase().includes(search.toLowerCase()) ||
    c.course_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <input className="form-input" style={{ maxWidth: 300 }}
          placeholder="Filter by code or name…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={async () => {
             const locked = list.filter(c => c.is_submitted).length
             if (!locked) { toast.warn('No locked courses to unlock.'); return; }
             if(!window.confirm(`Unlock all ${locked} submitted course(s)?`)) return;
             try {
               await coursesApi.unlockBulk({})
               toast.success(`✓ ${locked} course(s) unlocked.`)
               reload()
             } catch (err) {
               toast.error(err.response?.data?.message || 'Failed to unlock.')
             }
          }}>🔓 Unlock All</button>
          <button className="btn btn-primary" onClick={() => setModal(true)}>+ Add Course</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading
          ? <div className="loading" style={{ padding: 40 }}><div className="spinner" /></div>
          : filtered.length === 0
            ? <div className="empty-state"><div className="icon">▣</div><p>No courses found.</p></div>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>Code</th><th>Name</th><th>Type</th><th>Sem</th>
                    <th>Credits</th><th>Faculty</th><th>Components</th><th></th>
                  </tr></thead>
                  <tbody>
                    {filtered.map(c => (
                      <tr key={c.course_code}>
                        <td><span className="text-mono" style={{ color: 'var(--accent)' }}>{c.course_code}</span></td>
                        <td style={{ maxWidth: 200 }}>{c.course_name}</td>
                        <td><span className="badge badge-blue">{c.course_type}</span></td>
                        <td>Sem {c.semester}</td>
                        <td>{c.credits} cr</td>
                        <td style={{ fontSize: 12 }}>{c.faculty_name ?? c.faculty}</td>
                        <td colSpan="2">
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => window.open(`/courses/${c.course_code}`, '_blank')}>
                              View Course
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setCompModal(c.course_code)}>
                              + IA Components
                            </button>
                            {c.is_submitted && (
                              <button className="btn btn-ghost btn-sm" onClick={async () => {
                                try { await coursesApi.unlock(c.course_code); toast.success(`Course ${c.course_code} unlocked.`); reload(); }
                                catch { toast.error('Failed to unlock.'); }
                              }}>🔓 Unlock</button>
                            )}
                            <button className="btn btn-danger btn-sm"
                              disabled={deleting === c.course_code}
                              onClick={() => handleDelete(c.course_code, c.course_name)}>
                              {deleting === c.course_code ? '…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>

      {modal && (
        <AddCourseModal
          programs={programs}
          facultyList={facultyList}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); reload() }}
          toast={toast}
        />
      )}
      {compModal && (
        <IAComponentsModal
          courseCode={compModal}
          onClose={() => setCompModal(null)}
          toast={toast}
        />
      )}
    </div>
  )
}

function AddCourseModal({ programs, facultyList, onClose, onSaved, toast }) {
  const [form, setForm] = useState({
    course_code: '', course_name: '', course_type: 'Core', faculty: '', program: '',
    semester: '1', academic_year: '', term: '1',
    lecture_hrs: '3', tutorial_hrs: '1', practical_hrs: '0',
    credits: '4', int_weightage: '40', ese_weightage: '60',
    ese_mode: 'Written', ese_duration_hrs: '3', ese_max_marks: '100',
  })
  const [saving, setSaving] = useState(false)
  const f = k => e => {
    const val = e.target.value
    setForm(p => {
      const next = { ...p, [k]: val }
      // Auto-sync ESE weightage
      if (k === 'int_weightage') next.ese_weightage = String(100 - parseInt(val || 0))
      if (k === 'ese_weightage') next.int_weightage  = String(100 - parseInt(val || 0))
      return next
    })
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.course_code.trim()) { toast.error('Course Code is required.'); return }
    if (!form.course_name.trim()) { toast.error('Course Name is required.'); return }
    if (!form.faculty) { toast.error('Faculty is required.'); return }
    if (!form.program) { toast.error('Program is required.'); return }
    if (!form.academic_year.trim()) { toast.error('Academic Year is required.'); return }

    if (parseInt(form.int_weightage) + parseInt(form.ese_weightage) !== 100) {
      toast.error('IA + ESE weightage must sum to 100.')
      return
    }
    setSaving(true)
    try {
      await coursesApi.create({
        ...form,
        program:         parseInt(form.program),
        semester:        parseInt(form.semester),
        term:            parseInt(form.term),
        lecture_hrs:     parseInt(form.lecture_hrs),
        tutorial_hrs:    parseInt(form.tutorial_hrs),
        practical_hrs:   parseInt(form.practical_hrs),
        credits:         parseInt(form.credits),
        int_weightage:   parseInt(form.int_weightage),
        ese_weightage:   parseInt(form.ese_weightage),
        ese_duration_hrs: parseInt(form.ese_duration_hrs),
        ese_max_marks:   parseInt(form.ese_max_marks),
      })
      toast.success(`✓ Course ${form.course_code} created.`)
      onSaved()
    } catch (err) {
      const data = err.response?.data
      const msg  = data?.errors
        ? Object.entries(data.errors).map(([k,v]) => `${k}: ${v}`).join(' · ')
        : data?.message || 'Failed to create course.'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const weightageOk = parseInt(form.int_weightage||0) + parseInt(form.ese_weightage||0) === 100

  return (
    <Modal title="Add New Course" onClose={onClose} width={840}>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <FormField label="Course Code"   value={form.course_code}  onChange={f('course_code')}  placeholder="e.g. CS401" required />
          <div className="form-group">
            <label className="form-label">Course Type *</label>
            <select className="form-select" value={form.course_type} onChange={f('course_type')} required>
              {['Foundation','Core','MD','SEC','AECC','OE'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Course Name *</label>
            <input className="form-input" value={form.course_name} onChange={f('course_name')} placeholder="e.g. Operating Systems" required />
          </div>
          <div className="form-group">
            <label className="form-label">Faculty *</label>
            <select className="form-select" value={form.faculty} onChange={f('faculty')} required>
              <option value="">Select faculty…</option>
              {facultyList.map(fc => <option key={fc.faculty_id} value={fc.faculty_id}>{fc.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Program *</label>
            <select className="form-select" value={form.program} onChange={f('program')} required>
              <option value="">Select program…</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.short_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Semester *</label>
            <select className="form-select" value={form.semester} onChange={f('semester')} required>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(s => <option key={s} value={s}>Sem {s}</option>)}
            </select>
          </div>
          <FormField label="Academic Year" value={form.academic_year} onChange={f('academic_year')} placeholder="2024-2025" required />
          <FormField label="Term"          value={form.term}          onChange={f('term')}          type="number" min="1" required />
          <FormField label="Lecture Hrs"   value={form.lecture_hrs}   onChange={f('lecture_hrs')}   type="number" min="0" required />
          <FormField label="Tutorial Hrs"  value={form.tutorial_hrs}  onChange={f('tutorial_hrs')}  type="number" min="0" required />
          <FormField label="Practical Hrs" value={form.practical_hrs} onChange={f('practical_hrs')} type="number" min="0" required />
          <FormField label="Credits"       value={form.credits}       onChange={f('credits')}       type="number" min="1" required />
          <div className="form-group">
            <label className="form-label">IA Weightage % *</label>
            <input className="form-input" type="number" min="0" max="100"
              value={form.int_weightage} onChange={f('int_weightage')} required
              style={!weightageOk ? { borderColor: 'var(--red)' } : {}} />
          </div>
          <div className="form-group">
            <label className="form-label">ESE Weightage % *</label>
            <input className="form-input" type="number" min="0" max="100"
              value={form.ese_weightage} onChange={f('ese_weightage')} required
              style={!weightageOk ? { borderColor: 'var(--red)' } : {}} />
            {!weightageOk && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Must sum to 100</div>}
          </div>
          <div className="form-group">
            <label className="form-label">ESE Mode *</label>
            <select className="form-select" value={form.ese_mode} onChange={f('ese_mode')} required>
              {['Written','Viva Voce','Coding Test','Practical'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <FormField label="ESE Duration (hrs)" value={form.ese_duration_hrs} onChange={f('ese_duration_hrs')} type="number" min="1" required />
          <FormField label="ESE Max Marks"      value={form.ese_max_marks}    onChange={f('ese_max_marks')}    type="number" min="1" required />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !weightageOk}>
            {saving ? <><span className="spinner" style={{ width:14,height:14 }}/> Creating…</> : 'Create Course'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function IAComponentsModal({ courseCode, onClose, toast }) {
  const { data: existing, reload } = useList(() => iaComponents.list({ course: courseCode }))
  const [form, setForm] = useState({ name: '', mode: 'Offline', max_marks: '', weightage: '' })
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [intWeightage, setIntWeightage] = useState(100)
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  // Fetch course int_weightage
  useEffect(() => {
    coursesApi.get(courseCode).then(r => {
      setIntWeightage(r.data.int_weightage ?? 100)
    }).catch(() => {})
  }, [courseCode])

  const totalWt  = existing.reduce((a, c) => a + parseFloat(c.weightage || 0), 0)
  const remaining = intWeightage - totalWt  // out of IA weightage, not 100

  async function addComponent(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await iaComponents.create({
        course: courseCode,
        name: form.name,
        mode: form.mode,
        max_marks:  parseFloat(form.max_marks),
        weightage:  parseFloat(form.weightage),
      })
      toast.success(`✓ Component "${form.name}" added.`)
      setForm({ name: '', mode: 'Offline', max_marks: '', weightage: '' })
      reload()
    } catch (err) {
      const data = err.response?.data
      toast.error(data?.errors
        ? Object.entries(data.errors).map(([k,v]) => `${k}: ${v}`).join(' · ')
        : data?.message || 'Failed.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteComp(id, name) {
    if (!window.confirm(`Delete component "${name}"? All marks for it will be lost.`)) return
    setDeleting(id)
    try {
      await iaComponents.delete(id)
      toast.success(`✓ Component deleted.`)
      reload()
    } catch { toast.error('Delete failed.') }
    finally { setDeleting(null) }
  }

  return (
    <Modal title={`IA Components — ${courseCode}`} onClose={onClose} width={540}>
      {/* Existing */}
      {existing.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span>Current components</span>
            <span>Total weightage: <strong style={{ color: totalWt > intWeightage ? 'var(--red)' : 'var(--green)' }}>{totalWt}% / {intWeightage}%</strong></span>
          </div>
          {existing.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--surface2)', marginBottom: 6,
            }}>
              <span style={{ flex: 1, fontWeight: 600 }}>{c.name}</span>
              <span className="badge badge-gray">{c.mode}</span>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Max: {c.max_marks}</span>
              <span style={{ fontSize: 12, color: 'var(--accent)' }}>{c.weightage}%</span>
              <button className="btn btn-danger btn-sm" style={{ fontSize: 11 }}
                disabled={deleting === c.id}
                onClick={() => deleteComp(c.id, c.name)}>
                {deleting === c.id ? '…' : '×'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      <div style={{ borderTop: existing.length ? '1px solid var(--border)' : 'none', paddingTop: existing.length ? 16 : 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text2)' }}>Add Component</div>
        <form onSubmit={addComponent}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Name" value={form.name} onChange={f('name')} placeholder="e.g. Mid-Term Test" required />
            <div className="form-group">
              <label className="form-label">Mode *</label>
              <select className="form-select" value={form.mode} onChange={f('mode')} required>
                {['Online','Offline','Certificate','Hackathon'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <FormField label="Max Marks" value={form.max_marks} onChange={f('max_marks')} type="number" min="1" required />
            <div className="form-group">
              <label className="form-label">Weightage % * <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(~{remaining.toFixed(0)}% of {intWeightage}% left)</span></label>
              <input className="form-input" type="number" min="0" max={intWeightage} step="0.5"
                value={form.weightage} onChange={f('weightage')} required />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Done</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? '…' : '+ Add'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

// ── Reusable form field ───────────────────────────────────────
function FormField({ label, value, onChange, type = 'text', placeholder, required, min, style }) {
  return (
    <div className="form-group" style={style}>
      <label className="form-label">{label}{required ? ' *' : ''}</label>
      <input
        className="form-input"
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        min={min}
      />
    </div>
  )
}

// ══ ORGS PANEL ═══════════════════════════════════════════════
function OrgsPanel({ toast }) {
  const { data: facs, loading: lf, reload: rf } = useList(() => org.facultyOf({ page_size: 100 }))
  const { data: schools, loading: ls, reload: rs } = useList(() => org.schools({ page_size: 200 }))
  const { data: programs, loading: lp, reload: rp } = useList(() => org.programs({ page_size: 200 }))

  const [addFac, setAddFac] = useState(false)
  const [facForm, setFacForm] = useState({ name: '', short_name: '' })
  const [addSch, setAddSch] = useState(false)
  const [schForm, setSchForm] = useState({ name: '', short_name: '', faculty_of: '' })
  const [addProg, setAddProg] = useState(false)
  const [progForm, setProgForm] = useState({ name: '', short_name: '', school: '', duration_yrs: '4' })
  const [saving, setSaving] = useState(false)

  async function createFac(e) {
    e.preventDefault(); setSaving(true)
    try { await org.createFacultyOf(facForm); toast.success('Division created.'); rf(); setAddFac(false); setFacForm({ name: '', short_name: '' }) }
    catch (err) { toast.error(err.response?.data?.name?.[0] || 'Failed.') }
    finally { setSaving(false) }
  }
  async function deleteFac(id, name) {
    if (!window.confirm(`Delete division "${name}"?`)) return
    try { await org.deleteFacultyOf(id); toast.success('Deleted.'); rf() }
    catch { toast.error('Delete failed — may have associated schools.') }
  }
  async function createSch(e) {
    e.preventDefault(); setSaving(true)
    try { await org.createSchool({ ...schForm, faculty_of: parseInt(schForm.faculty_of) }); toast.success('School created.'); rs(); setAddSch(false); setSchForm({ name: '', short_name: '', faculty_of: '' }) }
    catch (err) { toast.error(err.response?.data?.name?.[0] || 'Failed.') }
    finally { setSaving(false) }
  }
  async function deleteSch(id, name) {
    if (!window.confirm(`Delete school "${name}"?`)) return
    try { await org.deleteSchool(id); toast.success('Deleted.'); rs() }
    catch { toast.error('Delete failed — may have associated programs.') }
  }
  async function createProg(e) {
    e.preventDefault(); setSaving(true)
    try { await org.createProgram({ ...progForm, school: parseInt(progForm.school), duration_yrs: parseInt(progForm.duration_yrs) }); toast.success('Program created.'); rp(); setAddProg(false); setProgForm({ name: '', short_name: '', school: '', duration_yrs: '4' }) }
    catch (err) { toast.error(err.response?.data?.name?.[0] || err.response?.data?.short_name?.[0] || 'Failed.') }
    finally { setSaving(false) }
  }
  async function deleteProg(id, name) {
    if (!window.confirm(`Delete program "${name}"?`)) return
    try { await org.deleteProgram(id); toast.success('Deleted.'); rp() }
    catch { toast.error('Delete failed — may have associated students/courses.') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Divisions / FacultyOf */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title">Academic Divisions ({facs.length})</div>
          <button className="btn btn-primary btn-sm" onClick={() => setAddFac(!addFac)}>{addFac ? 'Cancel' : '+ Add Division'}</button>
        </div>
        {addFac && (
          <form onSubmit={createFac} style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
            <FormField label="Name" value={facForm.name} onChange={e => setFacForm({ ...facForm, name: e.target.value })} required style={{ flex: 1 }} />
            <FormField label="Short Name" value={facForm.short_name} onChange={e => setFacForm({ ...facForm, short_name: e.target.value })} style={{ width: 120 }} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? '…' : 'Save'}</button>
          </form>
        )}
        {lf ? <div className="loading"><div className="spinner" /></div> : (
          <div className="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Short</th><th></th></tr></thead><tbody>
            {facs.map(f => (
              <tr key={f.id}><td>{f.id}</td><td>{f.name}</td><td>{f.short_name || '—'}</td>
              <td><button className="btn btn-danger btn-sm" onClick={() => deleteFac(f.id, f.name)}>Delete</button></td></tr>
            ))}
          </tbody></table></div>
        )}
      </div>

      {/* Schools */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title">Schools ({schools.length})</div>
          <button className="btn btn-primary btn-sm" onClick={() => setAddSch(!addSch)}>{addSch ? 'Cancel' : '+ Add School'}</button>
        </div>
        {addSch && (
          <form onSubmit={createSch} style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <FormField label="Name" value={schForm.name} onChange={e => setSchForm({ ...schForm, name: e.target.value })} required style={{ flex: 1, minWidth: 180 }} />
            <FormField label="Short Name" value={schForm.short_name} onChange={e => setSchForm({ ...schForm, short_name: e.target.value })} style={{ width: 120 }} />
            <div className="form-group" style={{ marginBottom: 0, width: 180 }}>
              <label className="form-label">Division *</label>
              <select className="form-select" value={schForm.faculty_of} onChange={e => setSchForm({ ...schForm, faculty_of: e.target.value })} required>
                <option value="">Select…</option>
                {facs.map(f => <option key={f.id} value={f.id}>{f.short_name || f.name}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? '…' : 'Save'}</button>
          </form>
        )}
        {ls ? <div className="loading"><div className="spinner" /></div> : (
          <div className="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Short</th><th>Division</th><th></th></tr></thead><tbody>
            {schools.map(s => (
              <tr key={s.id}><td>{s.id}</td><td>{s.name}</td><td>{s.short_name || '—'}</td><td>{s.faculty_of_name}</td>
              <td><button className="btn btn-danger btn-sm" onClick={() => deleteSch(s.id, s.name)}>Delete</button></td></tr>
            ))}
          </tbody></table></div>
        )}
      </div>

      {/* Programs */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title">Programs ({programs.length})</div>
          <button className="btn btn-primary btn-sm" onClick={() => setAddProg(!addProg)}>{addProg ? 'Cancel' : '+ Add Program'}</button>
        </div>
        {addProg && (
          <form onSubmit={createProg} style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <FormField label="Name" value={progForm.name} onChange={e => setProgForm({ ...progForm, name: e.target.value })} required style={{ flex: 1, minWidth: 150 }} />
            <FormField label="Short Name" value={progForm.short_name} onChange={e => setProgForm({ ...progForm, short_name: e.target.value })} required style={{ width: 100 }} />
            <div className="form-group" style={{ marginBottom: 0, width: 180 }}>
              <label className="form-label">School *</label>
              <select className="form-select" value={progForm.school} onChange={e => setProgForm({ ...progForm, school: e.target.value })} required>
                <option value="">Select…</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.short_name || s.name}</option>)}
              </select>
            </div>
            <FormField label="Duration (yrs)" value={progForm.duration_yrs} onChange={e => setProgForm({ ...progForm, duration_yrs: e.target.value })} type="number" min="1" required style={{ width: 100 }} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? '…' : 'Save'}</button>
          </form>
        )}
        {lp ? <div className="loading"><div className="spinner" /></div> : (
          <div className="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Short</th><th>School</th><th>Years</th><th></th></tr></thead><tbody>
            {programs.map(p => (
              <tr key={p.id}><td>{p.id}</td><td>{p.name}</td><td>{p.short_name}</td><td>{p.school_name}</td><td>{p.duration_yrs}</td>
              <td><button className="btn btn-danger btn-sm" onClick={() => deleteProg(p.id, p.name)}>Delete</button></td></tr>
            ))}
          </tbody></table></div>
        )}
      </div>
    </div>
  )
}
