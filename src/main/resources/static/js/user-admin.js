document.addEventListener('DOMContentLoaded', function() {
    const usersTbody = document.getElementById('usersTbody');
    const newUserBtn = document.getElementById('newUserBtn');
    const userModalEl = document.getElementById('userModal');
    const userModal = new bootstrap.Modal(userModalEl);
    const deleteModalEl = document.getElementById('deleteConfirmModal');
    const deleteModal = deleteModalEl ? new bootstrap.Modal(deleteModalEl) : null;
    const userForm = document.getElementById('userForm');
    const saveUserBtn = document.getElementById('saveUserBtn');
    const filterModal = new bootstrap.Modal(document.getElementById('filterModal'));

    // Estado de filtros actual
    let currentFilters = {
        rol: '',
        especialidad: '',
        activo: false,
        searchQuery: ''
    };
    let allUsers = []; // Guardar todos los usuarios para filtrar

    function formatRoles(roles) {
        if (!roles) return '';
        return roles.map(r => r.nombre || r).join(', ');
    }

    // Cargar opciones de roles y especialidades desde el backend
    function fetchRolesAndEspecialidades() {
        // Roles para modal de edición
        fetch('/api/roles')
            .then(r => r.json())
            .then(roles => {
                const rolesSelect = document.getElementById('rolesSelect');
                const filterRolSelect = document.getElementById('filterRol');
                if (!rolesSelect) return;
                // Usar el atributo disabled para el placeholder
                rolesSelect.innerHTML = '<option value="" disabled selected>Seleccione un rol</option>';
                filterRolSelect.innerHTML = '<option value="">Todos los roles</option>';
                roles.forEach(role => {
                    const option = document.createElement('option');
                    option.value = role.nombre;
                    option.textContent = role.nombre;
                    rolesSelect.appendChild(option);
                    
                    const filterOpt = option.cloneNode(true);
                    filterRolSelect.appendChild(filterOpt);
                });
            }).catch(err => console.error('No se pudieron cargar roles', err));

        // Especialidades
        fetch('/api/especialidades')
            .then(r => r.json())
            .then(especialidades => {
                const espSelect = document.getElementById('especialidadSelect');
                const filterEspSelect = document.getElementById('filterEspecialidad');
                if (!espSelect) return;
                // Mantener la opción 'Sin especificar' y añadir las demás
                espSelect.innerHTML = '<option value="">Sin especificar</option>';
                filterEspSelect.innerHTML = '<option value="">Todas las especialidades</option>';
                especialidades.forEach(e => {
                    const opt = document.createElement('option');
                    opt.value = e;
                    opt.textContent = e;
                    espSelect.appendChild(opt);
                    
                    const filterOpt = opt.cloneNode(true);
                    filterEspSelect.appendChild(filterOpt);
                });
            }).catch(err => console.error('No se pudieron cargar especialidades', err));
    }

    function fetchUsers() {
        usersTbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando...</td></tr>';
        fetch('/api/usuarios')
            .then(r => r.json())
            .then(users => {
                allUsers = users || [];
                applyFiltersAndDisplay();
            })
            .catch(err => {
                console.error(err);
                usersTbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error al cargar usuarios.</td></tr>';
            });
    }

    // CA 5.5: Filtro de permisos de Supervisor (solo ve Técnicos de su equipo)
    function isSupervisor() {
        // Lógica futura: revisar si el usuario actual es Supervisor
        // Por ahora retorna false; se implementa cuando haya autenticación
        return false;
    }

    function applyFiltersAndDisplay() {
        let filtered = allUsers;

        // CA 5.5: Si es Supervisor, filtrar para mostrar solo Técnicos
        if (isSupervisor()) {
            filtered = filtered.filter(u => 
                u.roles && u.roles.some(r => r.nombre && r.nombre.toUpperCase() === 'TÉCNICO')
            );
        }

        // CA 5.1: Filtro por Rol
        if (currentFilters.rol) {
            filtered = filtered.filter(u => 
                u.roles && u.roles.some(r => r.nombre === currentFilters.rol)
            );
        }

        // CA 5.2: Filtro por Especialidad
        if (currentFilters.especialidad) {
            filtered = filtered.filter(u => 
                u.especialidad && u.especialidad.toLowerCase() === currentFilters.especialidad.toLowerCase()
            );
        }

        // Filtro por estado activo
        if (currentFilters.activo) {
            filtered = filtered.filter(u => u.active || u.isActive);
        }

        // CA 5.3: Búsqueda por Nombre, Apellido, Email
        if (currentFilters.searchQuery) {
            const q = currentFilters.searchQuery.toLowerCase();
            filtered = filtered.filter(u => {
                const nombre = (u.nombre || '').toLowerCase();
                const apellido = (u.apellido || '').toLowerCase();
                const email = (u.email || '').toLowerCase();
                return nombre.includes(q) || apellido.includes(q) || email.includes(q);
            });
        }

        // CA 5.4: Mostrar "sin resultados" si no hay datos
        if (filtered.length === 0) {
            usersTbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay usuarios que coincidan.</td></tr>';
            document.getElementById('noResultsDiv').classList.remove('d-none');
            return;
        }

        document.getElementById('noResultsDiv').classList.add('d-none');

        usersTbody.innerHTML = '';
        filtered.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.id}</td>
                <td>${u.nombre || ''} ${u.apellido || ''}</td>
                <td>${u.email || ''}</td>
                <td>${u.especialidad || '-'}</td>
                <td>${formatRoles(u.roles)}</td>
                <td>${(u.active || u.isActive) ? 'Sí' : 'No'}</td>
                <td>
                    <button class="btn btn-sm btn-primary btn-edit" data-id="${u.id}">Editar</button>
                    <button class="btn btn-sm btn-danger btn-delete" data-id="${u.id}">Eliminar</button>
                    <button class="btn btn-sm btn-secondary btn-toggle" data-id="${u.id}">${(u.active || u.isActive) ? 'Desactivar' : 'Activar'}</button>
                </td>
            `;
            usersTbody.appendChild(tr);
        });
        attachRowEvents();
    }

    function updateFilterStatus() {
        const parts = [];
        if (currentFilters.rol) parts.push(`Rol: ${currentFilters.rol}`);
        if (currentFilters.especialidad) parts.push(`Especialidad: ${currentFilters.especialidad}`);
        if (currentFilters.activo) parts.push('Solo activos');
        if (currentFilters.searchQuery) parts.push(`Búsqueda: "${currentFilters.searchQuery}"`);
        
        const statusDiv = document.getElementById('filterStatusDiv');
        const statusSpan = document.getElementById('filterStatus');
        if (parts.length > 0) {
            statusSpan.textContent = parts.join(' | ');
            statusDiv.classList.remove('d-none');
        } else {
            statusDiv.classList.add('d-none');
        }
    }

    // Handlers de filtros
    document.getElementById('filterBtn').addEventListener('click', () => {
        filterModal.show();
    });

    document.getElementById('applyFiltersBtn').addEventListener('click', () => {
        currentFilters.rol = document.getElementById('filterRol').value;
        currentFilters.especialidad = document.getElementById('filterEspecialidad').value;
        currentFilters.activo = document.getElementById('filterActive').checked;
        updateFilterStatus();
        applyFiltersAndDisplay();
    });

    document.getElementById('resetFiltersBtn').addEventListener('click', () => {
        document.getElementById('filterRol').value = '';
        document.getElementById('filterEspecialidad').value = '';
        document.getElementById('filterActive').checked = false;
        currentFilters.rol = '';
        currentFilters.especialidad = '';
        currentFilters.activo = false;
        updateFilterStatus();
        applyFiltersAndDisplay();
    });

    document.getElementById('clearFiltersLink').addEventListener('click', (e) => {
        e.preventDefault();
        currentFilters.rol = '';
        currentFilters.especialidad = '';
        currentFilters.activo = false;
        currentFilters.searchQuery = '';
        document.getElementById('searchInput').value = '';
        updateFilterStatus();
        applyFiltersAndDisplay();
    });

    function attachRowEvents() {
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => openEdit(btn.dataset.id));
        });
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => showDeleteModal(btn.dataset.id));
        });
        document.querySelectorAll('.btn-toggle').forEach(btn => {
            btn.addEventListener('click', () => toggleActive(btn.dataset.id));
        });
    }

    // Mostrar modal de confirmación con opciones para eliminar o alternar estado
    function showDeleteModal(id) {
        if (!deleteModal) {
            // Fallback: confirmar con window.confirm
            if (!confirm('¿Eliminar usuario #' + id + '? Esta acción es definitiva.')) return;
            fetch(`/api/usuarios/${id}`, { method: 'DELETE' })
                .then(r => { if (r.ok) fetchUsers(); else alert('Error al eliminar'); })
                .catch(err => { console.error(err); alert('Error de red'); });
            return;
        }

        // Llenar mensaje con info del usuario si está disponible
        const messageEl = document.getElementById('deleteModalMessage');
        messageEl.textContent = '¿Realmente quiere eliminar este usuario?';

        // Guardar id en botones dataset
        const modalDeleteBtn = document.getElementById('modalDeleteBtn');
        const modalToggleBtn = document.getElementById('modalToggleBtn');
        modalDeleteBtn.dataset.userid = id;
        modalToggleBtn.dataset.userid = id;

        deleteModal.show();
    }

    // Handler para el botón Eliminar definitivamente
    if (document.getElementById('modalDeleteBtn')) {
        document.getElementById('modalDeleteBtn').addEventListener('click', function() {
            const id = this.dataset.userid;
            if (!id) return;
            fetch(`/api/usuarios/${id}`, { method: 'DELETE' })
                .then(r => {
                    if (r.ok) {
                        deleteModal.hide();
                        fetchUsers();
                    } else {
                        r.text().then(t => alert('Error al eliminar: ' + t));
                    }
                })
                .catch(err => { console.error(err); alert('Error de red'); });
        });
    }

    // Handler para Activar/Desactivar desde el modal
    if (document.getElementById('modalToggleBtn')) {
        document.getElementById('modalToggleBtn').addEventListener('click', function() {
            const id = this.dataset.userid;
            if (!id) return;
            toggleActive(id).then(() => {
                deleteModal.hide();
                fetchUsers();
            }).catch(err => {
                console.error(err);
                alert('Error al alternar estado: ' + err.message);
            });
        });
    }

    function openEdit(id) {
        // Cargar datos del usuario por id y abrir modal
        fetch(`/api/usuarios/${id}`)
            .then(r => {
                if (!r.ok) throw new Error('Usuario no encontrado');
                return r.json();
            })
            .then(user => {
                document.getElementById('userId').value = user.id;
                document.getElementById('nombre').value = user.nombre || '';
                document.getElementById('apellido').value = user.apellido || '';
                document.getElementById('email').value = user.email || '';
                
                // Roles: seleccionar el rol del usuario
                const rolesSelect = document.getElementById('rolesSelect');
                if (rolesSelect && user.roles && user.roles.length > 0) {
                    rolesSelect.value = user.roles[0].nombre || user.roles[0];
                } else {
                    rolesSelect.value = '';
                }
                
                // Especialidad
                const espSelect = document.getElementById('especialidadSelect');
                if (espSelect) {
                    espSelect.value = user.especialidad || '';
                }
                document.getElementById('isActiveCheck').checked = !!(user.active || user.isActive);
                document.getElementById('password').value = '';
                document.getElementById('userModalTitle').textContent = 'Editar usuario';
                userModal.show();
            })
            .catch(err => { console.error(err); alert('Error al cargar usuario: ' + err.message); });
    }


    // deleteUser se mantiene como fallback pero no se usa directamente ahora
    function deleteUser(id) {
        return fetch(`/api/usuarios/${id}`, { method: 'DELETE' })
            .then(r => {
                if (r.ok) return true;
                throw new Error('Error al eliminar');
            });
    }

    function toggleActive(id) {
        // Obtener usuario por id, invertir isActive y llamar PUT /api/usuarios/{id}
        fetch(`/api/usuarios/${id}`)
            .then(r => {
                if (!r.ok) throw new Error('Usuario no encontrado');
                return r.json();
            })
            .then(user => {
                const updated = {
                    nombre: user.nombre,
                    apellido: user.apellido,
                    email: user.email,
                    roles: user.roles,
                    isActive: !user.isActive
                };
                return fetch(`/api/usuarios/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updated)
                });
            })
            .then(r => {
                if (r.ok) return fetchUsers();
                return r.text().then(t => { throw new Error(t || 'No se pudo actualizar'); });
            })
            .catch(err => { console.error(err); throw err; });
    }

    saveUserBtn.addEventListener('click', () => {
        const id = document.getElementById('userId').value;
        const payload = {
            nombre: document.getElementById('nombre').value,
            apellido: document.getElementById('apellido').value,
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            // rol como array con un solo objeto { nombre: 'ROLE' }
            roles: [{ nombre: document.getElementById('rolesSelect').value }],
            especialidad: document.getElementById('especialidadSelect').value || null,
            isActive: document.getElementById('isActiveCheck').checked
        };
        if (id) {
            fetch(`/api/usuarios/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            }).then(r => { if (r.ok) { userModal.hide(); fetchUsers(); } else alert('Error al actualizar'); });
        } else {
            // Crear nuevo usuario (endpoint de register) - enviar 'rol' como string (primer rol seleccionado)
            const firstRole = (payload.roles && payload.roles.length > 0) ? payload.roles[0].nombre : '';
            const registerPayload = {
                nombre: payload.nombre,
                apellido: payload.apellido,
                email: payload.email,
                password: payload.password,
                especialidad: payload.especialidad,
                rol: firstRole
            };
            fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(registerPayload) })
                .then(r => r.json())
                .then(res => {
                    if (res.success) { userModal.hide(); fetchUsers(); } else alert(res.message || 'Error al crear');
                }).catch(err => { console.error(err); alert('Error de red'); });
        }
    });

    newUserBtn.addEventListener('click', () => {
        document.getElementById('userForm').reset();
        document.getElementById('userId').value = '';
        // limpiar selects
        const rolesSelect = document.getElementById('rolesSelect');
        if (rolesSelect) Array.from(rolesSelect.options).forEach(o => o.selected = false);
        const espSelect = document.getElementById('especialidadSelect');
        if (espSelect) espSelect.value = '';
        document.getElementById('userModalTitle').textContent = 'Nuevo usuario';
        userModal.show();
    });

    // Búsqueda simple
    document.getElementById('searchBtn').addEventListener('click', () => {
        currentFilters.searchQuery = document.getElementById('searchInput').value;
        updateFilterStatus();
        applyFiltersAndDisplay();
    });

    // Búsqueda al presionar Enter en el input
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('searchBtn').click();
        }
    });

    // Carga inicial
    fetchRolesAndEspecialidades();
    fetchUsers();
});
